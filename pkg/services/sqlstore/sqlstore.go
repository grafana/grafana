package sqlstore

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	_ "github.com/grafana/grafana/pkg/tsdb/mssql"
	"github.com/grafana/grafana/pkg/util"
	_ "github.com/lib/pq"
)

var (
	x       *xorm.Engine
	dialect migrator.Dialect

	sqlog log.Logger = log.New("sqlstore")
)

const ContextSessionName = "db-session"

func init() {
	// This change will make xorm use an empty default schema for postgres and
	// by that mimic the functionality of how it was functioning before
	// xorm's changes above.
	xorm.DefaultPostgresSchema = ""

	registry.Register(&registry.Descriptor{
		Name:         "SqlStore",
		Instance:     &SqlStore{},
		InitPriority: registry.High,
	})
}

type SqlStore struct {
	Cfg          *setting.Cfg             `inject:""`
	Bus          bus.Bus                  `inject:""`
	CacheService *localcache.CacheService `inject:""`

	DBCfg           DatabaseConfig
	engine          *xorm.Engine
	log             log.Logger
	Dialect         migrator.Dialect
	skipEnsureAdmin bool
}

func (ss *SqlStore) Init() error {
	ss.log = log.New("sqlstore")
	ss.readConfig()

	engine, err := ss.getEngine()

	if err != nil {
		return fmt.Errorf("Fail to connect to database: %v", err)
	}

	ss.engine = engine
	ss.Dialect = migrator.NewDialect(ss.engine)

	// temporarily still set global var
	x = engine
	dialect = ss.Dialect

	migrator := migrator.NewMigrator(x)
	migrations.AddMigrations(migrator)

	for _, descriptor := range registry.GetServices() {
		sc, ok := descriptor.Instance.(registry.DatabaseMigrator)
		if ok {
			sc.AddMigration(migrator)
		}
	}

	if err := migrator.Start(); err != nil {
		return fmt.Errorf("Migration failed err: %v", err)
	}

	// Init repo instances
	annotations.SetRepository(&SqlAnnotationRepo{})
	ss.Bus.SetTransactionManager(ss)

	// Register handlers
	ss.addUserQueryAndCommandHandlers()

	// ensure admin user
	if ss.skipEnsureAdmin {
		return nil
	}

	return ss.ensureAdminUser()
}

func (ss *SqlStore) ensureAdminUser() error {
	systemUserCountQuery := m.GetSystemUserCountStatsQuery{}

	err := ss.InTransaction(context.Background(), func(ctx context.Context) error {

		err := bus.DispatchCtx(ctx, &systemUserCountQuery)
		if err != nil {
			return fmt.Errorf("Could not determine if admin user exists: %v", err)
		}

		if systemUserCountQuery.Result.Count > 0 {
			return nil
		}

		cmd := m.CreateUserCommand{}
		cmd.Login = setting.AdminUser
		cmd.Email = setting.AdminUser + "@localhost"
		cmd.Password = setting.AdminPassword
		cmd.IsAdmin = true

		if err := bus.DispatchCtx(ctx, &cmd); err != nil {
			return fmt.Errorf("Failed to create admin user: %v", err)
		}

		ss.log.Info("Created default admin", "user", setting.AdminUser)

		return nil
	})

	return err
}

func (ss *SqlStore) buildExtraConnectionString(sep rune) string {
	if ss.DBCfg.UrlQueryParams == nil {
		return ""
	}

	var sb strings.Builder
	for key, values := range ss.DBCfg.UrlQueryParams {
		for _, value := range values {
			sb.WriteRune(sep)
			sb.WriteString(key)
			sb.WriteRune('=')
			sb.WriteString(value)
		}
	}
	return sb.String()
}

func (ss *SqlStore) BuildConnectionString() (string, error) {
	cnnstr := ss.DBCfg.ConnectionString

	// special case used by integration tests
	if cnnstr != "" {
		return cnnstr, nil
	}

	switch ss.DBCfg.Type {
	case migrator.MYSQL:
		protocol := "tcp"
		if strings.HasPrefix(ss.DBCfg.Host, "/") {
			protocol = "unix"
		}

		cnnstr = fmt.Sprintf("%s:%s@%s(%s)/%s?collation=utf8mb4_unicode_ci&allowNativePasswords=true",
			ss.DBCfg.User, ss.DBCfg.Pwd, protocol, ss.DBCfg.Host, ss.DBCfg.Name)

		if ss.DBCfg.SslMode == "true" || ss.DBCfg.SslMode == "skip-verify" {
			tlsCert, err := makeCert(ss.DBCfg)
			if err != nil {
				return "", err
			}
			mysql.RegisterTLSConfig("custom", tlsCert)
			cnnstr += "&tls=custom"
		}

		cnnstr += ss.buildExtraConnectionString('&')
	case migrator.POSTGRES:
		host, port := util.SplitHostPortDefault(ss.DBCfg.Host, "127.0.0.1", "5432")
		if ss.DBCfg.Pwd == "" {
			ss.DBCfg.Pwd = "''"
		}
		if ss.DBCfg.User == "" {
			ss.DBCfg.User = "''"
		}
		cnnstr = fmt.Sprintf("user=%s password=%s host=%s port=%s dbname=%s sslmode=%s sslcert=%s sslkey=%s sslrootcert=%s", ss.DBCfg.User, ss.DBCfg.Pwd, host, port, ss.DBCfg.Name, ss.DBCfg.SslMode, ss.DBCfg.ClientCertPath, ss.DBCfg.ClientKeyPath, ss.DBCfg.CaCertPath)

		cnnstr += ss.buildExtraConnectionString(' ')
	case migrator.SQLITE:
		// special case for tests
		if !filepath.IsAbs(ss.DBCfg.Path) {
			ss.DBCfg.Path = filepath.Join(ss.Cfg.DataPath, ss.DBCfg.Path)
		}
		os.MkdirAll(path.Dir(ss.DBCfg.Path), os.ModePerm)
		cnnstr = fmt.Sprintf("file:%s?cache=%s&mode=rwc", ss.DBCfg.Path, ss.DBCfg.CacheMode)
		cnnstr += ss.buildExtraConnectionString('&')
	default:
		return "", fmt.Errorf("Unknown database type: %s", ss.DBCfg.Type)
	}

	return cnnstr, nil
}

func (ss *SqlStore) getEngine() (*xorm.Engine, error) {
	connectionString, err := ss.BuildConnectionString()

	if err != nil {
		return nil, err
	}

	sqlog.Info("Connecting to DB", "dbtype", ss.DBCfg.Type)
	engine, err := xorm.NewEngine(ss.DBCfg.Type, connectionString)
	if err != nil {
		return nil, err
	}

	engine.SetMaxOpenConns(ss.DBCfg.MaxOpenConn)
	engine.SetMaxIdleConns(ss.DBCfg.MaxIdleConn)
	engine.SetConnMaxLifetime(time.Second * time.Duration(ss.DBCfg.ConnMaxLifetime))

	// configure sql logging
	debugSql := ss.Cfg.Raw.Section("database").Key("log_queries").MustBool(false)
	if !debugSql {
		engine.SetLogger(&xorm.DiscardLogger{})
	} else {
		engine.SetLogger(NewXormLogger(log.LvlInfo, log.New("sqlstore.xorm")))
		engine.ShowSQL(true)
		engine.ShowExecTime(true)
	}

	return engine, nil
}

func (ss *SqlStore) readConfig() {
	sec := ss.Cfg.Raw.Section("database")

	cfgURL := sec.Key("url").String()
	if len(cfgURL) != 0 {
		dbURL, _ := url.Parse(cfgURL)
		ss.DBCfg.Type = dbURL.Scheme
		ss.DBCfg.Host = dbURL.Host

		pathSplit := strings.Split(dbURL.Path, "/")
		if len(pathSplit) > 1 {
			ss.DBCfg.Name = pathSplit[1]
		}

		userInfo := dbURL.User
		if userInfo != nil {
			ss.DBCfg.User = userInfo.Username()
			ss.DBCfg.Pwd, _ = userInfo.Password()
		}

		ss.DBCfg.UrlQueryParams = dbURL.Query()
	} else {
		ss.DBCfg.Type = sec.Key("type").String()
		ss.DBCfg.Host = sec.Key("host").String()
		ss.DBCfg.Name = sec.Key("name").String()
		ss.DBCfg.User = sec.Key("user").String()
		ss.DBCfg.ConnectionString = sec.Key("connection_string").String()
		ss.DBCfg.Pwd = sec.Key("password").String()
	}

	ss.DBCfg.MaxOpenConn = sec.Key("max_open_conn").MustInt(0)
	ss.DBCfg.MaxIdleConn = sec.Key("max_idle_conn").MustInt(2)
	ss.DBCfg.ConnMaxLifetime = sec.Key("conn_max_lifetime").MustInt(14400)

	ss.DBCfg.SslMode = sec.Key("ssl_mode").String()
	ss.DBCfg.CaCertPath = sec.Key("ca_cert_path").String()
	ss.DBCfg.ClientKeyPath = sec.Key("client_key_path").String()
	ss.DBCfg.ClientCertPath = sec.Key("client_cert_path").String()
	ss.DBCfg.ServerCertName = sec.Key("server_cert_name").String()
	ss.DBCfg.Path = sec.Key("path").MustString("data/grafana.db")
	ss.DBCfg.Logs = sec.Key("log_queries").MustBool(false)

	ss.DBCfg.CacheMode = sec.Key("cache_mode").MustString("private")
}

// Interface of arguments for testing db
type ITestDB interface {
	Helper()
	Fatalf(format string, args ...interface{})
}

// InitTestDB initiliaze test DB
func InitTestDB(t ITestDB) *SqlStore {
	t.Helper()
	sqlstore := &SqlStore{}
	sqlstore.skipEnsureAdmin = true
	sqlstore.Bus = bus.New()
	sqlstore.CacheService = localcache.New(5*time.Minute, 10*time.Minute)

	dbType := migrator.SQLITE

	// environment variable present for test db?
	if db, present := os.LookupEnv("GRAFANA_TEST_DB"); present {
		dbType = db
	}

	// set test db config
	sqlstore.Cfg = setting.NewCfg()
	sec, _ := sqlstore.Cfg.Raw.NewSection("database")
	sec.NewKey("type", dbType)

	switch dbType {
	case "mysql":
		sec.NewKey("connection_string", sqlutil.TestDB_Mysql.ConnStr)
	case "postgres":
		sec.NewKey("connection_string", sqlutil.TestDB_Postgres.ConnStr)
	default:
		sec.NewKey("connection_string", sqlutil.TestDB_Sqlite3.ConnStr)
	}

	// need to get engine to clean db before we init
	engine, err := xorm.NewEngine(dbType, sec.Key("connection_string").String())
	if err != nil {
		t.Fatalf("Failed to init test database: %v", err)
	}

	sqlstore.Dialect = migrator.NewDialect(engine)

	// temp global var until we get rid of global vars
	dialect = sqlstore.Dialect

	if err := dialect.CleanDB(); err != nil {
		t.Fatalf("Failed to clean test db %v", err)
	}

	if err := sqlstore.Init(); err != nil {
		t.Fatalf("Failed to init test database: %v", err)
	}

	sqlstore.engine.DatabaseTZ = time.UTC
	sqlstore.engine.TZLocation = time.UTC

	return sqlstore
}

func IsTestDbMySql() bool {
	if db, present := os.LookupEnv("GRAFANA_TEST_DB"); present {
		return db == migrator.MYSQL
	}

	return false
}

func IsTestDbPostgres() bool {
	if db, present := os.LookupEnv("GRAFANA_TEST_DB"); present {
		return db == migrator.POSTGRES
	}

	return false
}

type DatabaseConfig struct {
	Type             string
	Host             string
	Name             string
	User             string
	Pwd              string
	Path             string
	SslMode          string
	CaCertPath       string
	ClientKeyPath    string
	ClientCertPath   string
	ServerCertName   string
	ConnectionString string
	MaxOpenConn      int
	MaxIdleConn      int
	ConnMaxLifetime  int
	CacheMode        string
	UrlQueryParams   map[string][]string
	Logs             bool
}
