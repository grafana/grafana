package testdb

import (
	"database/sql"
	"testing"

	"github.com/jmoiron/sqlx"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	testsqlutil "github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	storagemigrator "github.com/grafana/grafana/pkg/storage/sqlutil/migrator"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/grafana/grafana/pkg/util/sqlite"
	_ "github.com/lib/pq"
)

type SessionProvider struct {
	session *session.SessionDB
	cleanup func()
}

func NewSessionProvider(t testing.TB) (*SessionProvider, *setting.Cfg) {
	t.Helper()

	cfg := setting.NewCfg()
	ConfigureDatabase(t, cfg)

	dbType := cfg.SectionWithEnvOverrides("database").Key("type").String()
	dbCfg, err := newDatabaseConfig(cfg)
	if err != nil {
		t.Fatalf("build database config: %v", err)
	}

	db, err := sql.Open(dbType, dbCfg.ConnectionString)
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	return &SessionProvider{
		session: session.GetSession(sqlx.NewDb(db, dbType)),
		cleanup: func() {},
	}, cfg
}

func (p *SessionProvider) GetSqlxSession() *session.SessionDB {
	return p.session
}

func (p *SessionProvider) SqlDB() *sql.DB {
	return p.session.SqlDB()
}

func ConfigureDatabase(t testing.TB, cfg *setting.Cfg) {
	t.Helper()

	sec := cfg.SectionWithEnvOverrides("database")
	switch TestDBType() {
	case storagemigrator.MySQL, storagemigrator.Postgres:
		testDB, err := testsqlutil.GetTestDB(TestDBType())
		if err != nil {
			t.Fatalf("load test database config: %v", err)
		}
		sec.Key("type").SetValue(testDB.DriverName)
		sec.Key("host").SetValue(testDB.Host)
		sec.Key("port").SetValue(testDB.Port)
		sec.Key("user").SetValue(testDB.User)
		sec.Key("password").SetValue(testDB.Password)
		sec.Key("name").SetValue(testDB.Database)
	default:
		sec.Key("type").SetValue(storagemigrator.SQLite)
		sec.Key("path").SetValue(t.TempDir() + "/grafana-test.db")
	}
}

func IsSQLite() bool {
	return TestDBType() == storagemigrator.SQLite
}

func TestDBType() string {
	return testsqlutil.GetTestDBType()
}

type databaseConfig struct {
	ConnectionString string
}

func newDatabaseConfig(cfg *setting.Cfg) (*databaseConfig, error) {
	sec := cfg.SectionWithEnvOverrides("database")

	switch sec.Key("type").String() {
	case storagemigrator.MySQL:
		testDB, err := testsqlutil.GetTestDB(storagemigrator.MySQL)
		if err != nil {
			return nil, err
		}
		return &databaseConfig{ConnectionString: testDB.ConnStr}, nil
	case storagemigrator.Postgres:
		testDB, err := testsqlutil.GetTestDB(storagemigrator.Postgres)
		if err != nil {
			return nil, err
		}
		return &databaseConfig{ConnectionString: testDB.ConnStr}, nil
	default:
		path := sec.Key("path").String()
		return &databaseConfig{ConnectionString: "file:" + path + "?cache=private&mode=rwc&_journal_mode=WAL&_synchronous=OFF"}, nil
	}
}
