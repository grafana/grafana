package sqlstore

import (
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/go-sql-driver/mysql"
	_ "github.com/go-sql-driver/mysql"
	"github.com/go-xorm/xorm"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
)

type DatabaseConfig struct {
	Type, Host, Name, User, Pwd, Path, SslMode string
	CaCertPath                                 string
	ClientKeyPath                              string
	ClientCertPath                             string
	ServerCertName                             string
	MaxOpenConn                                int
	MaxIdleConn                                int
}

var (
	x       *xorm.Engine
	dialect migrator.Dialect

	HasEngine bool

	DbCfg DatabaseConfig

	UseSQLite3 bool
	sqlog      log.Logger = log.New("sqlstore")
)

func EnsureAdminUser() {
	statsQuery := m.GetSystemStatsQuery{}

	if err := bus.Dispatch(&statsQuery); err != nil {
		log.Fatal(3, "Could not determine if admin user exists: %v", err)
		return
	}

	if statsQuery.Result.Users > 0 {
		return
	}

	cmd := m.CreateUserCommand{}
	cmd.Login = setting.AdminUser
	cmd.Email = setting.AdminUser + "@localhost"
	cmd.Password = setting.AdminPassword
	cmd.IsAdmin = true

	if err := bus.Dispatch(&cmd); err != nil {
		log.Error(3, "Failed to create default admin user", err)
		return
	}

	log.Info("Created default admin user: %v", setting.AdminUser)
}

func NewEngine() {
	x, err := getEngine()

	if err != nil {
		sqlog.Crit("Fail to connect to database", "error", err)
		os.Exit(1)
	}

	err = SetEngine(x)

	if err != nil {
		sqlog.Error("Fail to initialize orm engine", "error", err)
		os.Exit(1)
	}
}

func SetEngine(engine *xorm.Engine) (err error) {
	x = engine
	dialect = migrator.NewDialect(x.DriverName())

	migrator := migrator.NewMigrator(x)
	migrations.AddMigrations(migrator)

	if err := migrator.Start(); err != nil {
		return fmt.Errorf("Sqlstore::Migration failed err: %v\n", err)
	}

	// Init repo instances
	annotations.SetRepository(&SqlAnnotationRepo{})
	dashboards.SetRepository(&dashboards.DashboardRepository{})
	return nil
}

func getEngine() (*xorm.Engine, error) {
	LoadConfig()

	cnnstr := ""
	switch DbCfg.Type {
	case "mysql":
		protocol := "tcp"
		if strings.HasPrefix(DbCfg.Host, "/") {
			protocol = "unix"
		}

		cnnstr = fmt.Sprintf("%s:%s@%s(%s)/%s?collation=utf8mb4_unicode_ci&allowNativePasswords=true",
			DbCfg.User, DbCfg.Pwd, protocol, DbCfg.Host, DbCfg.Name)

		if DbCfg.SslMode == "true" || DbCfg.SslMode == "skip-verify" {
			tlsCert, err := makeCert("custom", DbCfg)
			if err != nil {
				return nil, err
			}
			mysql.RegisterTLSConfig("custom", tlsCert)
			cnnstr += "&tls=custom"
		}
	case "postgres":
		var host, port = "127.0.0.1", "5432"
		fields := strings.Split(DbCfg.Host, ":")
		if len(fields) > 0 && len(strings.TrimSpace(fields[0])) > 0 {
			host = fields[0]
		}
		if len(fields) > 1 && len(strings.TrimSpace(fields[1])) > 0 {
			port = fields[1]
		}
		if DbCfg.Pwd == "" {
			DbCfg.Pwd = "''"
		}
		if DbCfg.User == "" {
			DbCfg.User = "''"
		}
		cnnstr = fmt.Sprintf("user=%s password=%s host=%s port=%s dbname=%s sslmode=%s sslcert=%s sslkey=%s sslrootcert=%s", DbCfg.User, DbCfg.Pwd, host, port, DbCfg.Name, DbCfg.SslMode, DbCfg.ClientCertPath, DbCfg.ClientKeyPath, DbCfg.CaCertPath)
	case "sqlite3":
		if !filepath.IsAbs(DbCfg.Path) {
			DbCfg.Path = filepath.Join(setting.DataPath, DbCfg.Path)
		}
		os.MkdirAll(path.Dir(DbCfg.Path), os.ModePerm)
		cnnstr = "file:" + DbCfg.Path + "?cache=shared&mode=rwc"
	default:
		return nil, fmt.Errorf("Unknown database type: %s", DbCfg.Type)
	}

	sqlog.Info("Initializing DB", "dbtype", DbCfg.Type)
	engine, err := xorm.NewEngine(DbCfg.Type, cnnstr)
	if err != nil {
		return nil, err
	} else {
		engine.SetMaxOpenConns(DbCfg.MaxOpenConn)
		engine.SetMaxIdleConns(DbCfg.MaxIdleConn)
		debugSql := setting.Cfg.Section("database").Key("log_queries").MustBool(false)
		if !debugSql {
			engine.SetLogger(&xorm.DiscardLogger{})
		} else {
			engine.SetLogger(NewXormLogger(log.LvlInfo, log.New("sqlstore.xorm")))
			engine.ShowSQL(true)
			engine.ShowExecTime(true)
		}
	}
	return engine, nil
}

func LoadConfig() {
	sec := setting.Cfg.Section("database")

	cfgURL := sec.Key("url").String()
	if len(cfgURL) != 0 {
		dbURL, _ := url.Parse(cfgURL)
		DbCfg.Type = dbURL.Scheme
		DbCfg.Host = dbURL.Host

		pathSplit := strings.Split(dbURL.Path, "/")
		if len(pathSplit) > 1 {
			DbCfg.Name = pathSplit[1]
		}

		userInfo := dbURL.User
		if userInfo != nil {
			DbCfg.User = userInfo.Username()
			DbCfg.Pwd, _ = userInfo.Password()
		}
	} else {
		DbCfg.Type = sec.Key("type").String()
		DbCfg.Host = sec.Key("host").String()
		DbCfg.Name = sec.Key("name").String()
		DbCfg.User = sec.Key("user").String()
		if len(DbCfg.Pwd) == 0 {
			DbCfg.Pwd = sec.Key("password").String()
		}
	}
	DbCfg.MaxOpenConn = sec.Key("max_open_conn").MustInt(0)
	DbCfg.MaxIdleConn = sec.Key("max_idle_conn").MustInt(0)

	if DbCfg.Type == "sqlite3" {
		UseSQLite3 = true
		// only allow one connection as sqlite3 has multi threading issues that cause table locks
		// DbCfg.MaxIdleConn = 1
		// DbCfg.MaxOpenConn = 1
	}
	DbCfg.SslMode = sec.Key("ssl_mode").String()
	DbCfg.CaCertPath = sec.Key("ca_cert_path").String()
	DbCfg.ClientKeyPath = sec.Key("client_key_path").String()
	DbCfg.ClientCertPath = sec.Key("client_cert_path").String()
	DbCfg.ServerCertName = sec.Key("server_cert_name").String()
	DbCfg.Path = sec.Key("path").MustString("data/grafana.db")
}
