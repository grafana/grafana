package dbimpl

import (
	"context"
	"database/sql"
	"sync"
	"testing"

	"github.com/gchaincl/sqlhooks"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"
	ini "gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/sqlite"
)

type (
	// cfgSectionMap represents an INI section, mapping from an INI key to an
	// INI value.
	cfgSectionMap = map[string]string
	// cfgMap is a map from INI section name to INI section contents.
	cfgMap = map[string]cfgSectionMap
)

// setupDBForGrafana modifies `m` in the following way:
//
//	[database]
//	type = sqlite3
//	path = unique-random-path
//
// After that, it initializes a temporary SQLite filesystem-backed database that
// is later deleted when the test finishes.
func setupDBForGrafana(t *testing.T, ctx context.Context, m cfgMap) {
	dbSection, ok := m["database"]
	if !ok {
		dbSection = cfgSectionMap{}
		m["database"] = dbSection
	}
	dbSection["type"] = "sqlite3"
	dbSection["path"] = t.TempDir() + "/" + uuid.New().String()

	db, err := sql.Open("sqlite3", "file:"+dbSection["path"])
	require.NoError(t, err)

	_, err = db.ExecContext(ctx, `
		CREATE TABLE user (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			version INTEGER NOT NULL,
			login TEXT NOT NULL,
			email TEXT NOT NULL,
			name TEXT NULL,
			password TEXT NULL,
			salt TEXT NULL,
			rands TEXT NULL,
			company TEXT NULL,
			org_id INTEGER NOT NULL,
			is_admin INTEGER NOT NULL,
			email_verified INTEGER NULL,
			theme TEXT NULL,
			created DATETIME NOT NULL,
			updated DATETIME NOT NULL,
			help_flags1 INTEGER NOT NULL DEFAULT 0,
			last_seen_at DATETIME NULL,
			is_disabled INTEGER NOT NULL DEFAULT 0,
			is_service_account BOOLEAN DEFAULT 0,
			is_provisioned BOOLEAN DEFAULT 0,
			uid TEXT NULL
		);
		CREATE TABLE org (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			version INTEGER NOT NULL,
			name TEXT NOT NULL,
			address1 TEXT NULL,
			address2 TEXT NULL,
			city TEXT NULL,
			state TEXT NULL,
			zip_code TEXT NULL,
			country TEXT NULL,
			billing_email TEXT NULL,
			created DATETIME NOT NULL,
			updated DATETIME NOT NULL
		);
		CREATE TABLE org_user (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			org_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			role TEXT NOT NULL,
			created DATETIME NOT NULL,
			updated DATETIME NOT NULL
		);
	`)
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, db.Close())
	})
}

type testSessionProvider struct {
	session *session.SessionDB
}

func (p *testSessionProvider) GetSqlxSession() *session.SessionDB {
	return p.session
}

func (p *testSessionProvider) SqlDB() *sql.DB {
	return p.session.SqlDB()
}

type noOpSQLHooks struct{}

func (noOpSQLHooks) Before(ctx context.Context, _ string, _ ...any) (context.Context, error) {
	return ctx, nil
}

func (noOpSQLHooks) After(ctx context.Context, _ string, _ ...any) (context.Context, error) {
	return ctx, nil
}

func (noOpSQLHooks) OnError(_ context.Context, err error, _ string, _ ...any) error {
	return err
}

func newTestInfraDB(t *testing.T, m cfgMap) *testSessionProvider {
	t.Helper()
	cfg := newCfgFromIniMap(t, m)
	dbSection := cfg.SectionWithEnvOverrides("database")
	driverName := dbSection.Key("type").String()
	connStr := "file:" + dbSection.Key("path").String()
	if dbSection.Key(grafanaDBInstrumentQueriesKey).MustBool(false) {
		driverName = "sqlite3-hooks-" + uuid.NewString()
		sql.Register(driverName, sqlhooks.Wrap(&sqlite.Driver{}, noOpSQLHooks{}))
	}

	db, err := sql.Open(driverName, connStr)
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, db.Close())
	})

	return &testSessionProvider{
		session: session.GetSession(sqlx.NewDb(db, driverName)),
	}
}

// globalUnprotectedMutableState controls access to global mutable state found
// in the `setting` package that is not appropriately protected. This would
// ideally be a part of some struct instead of being global, be protected if it
// needs to change, and be unmutable once it no longer needs to change. Example:
// `setting.AppUrl`. Nothing can run in parallel because of this.
// TODO: fix that.
var globalUnprotectedMutableState sync.Mutex

func newCfgFromIniMap(t *testing.T, m cfgMap) *setting.Cfg {
	t.Helper()
	globalUnprotectedMutableState.Lock()
	defer globalUnprotectedMutableState.Unlock()
	cfg, err := setting.NewCfgFromINIFile(newTestINIFile(t, m))
	require.NoError(t, err)
	return cfg
}

func newTestINIFile(t *testing.T, m cfgMap) *ini.File {
	t.Helper()
	f := ini.Empty()
	for sectionName, kvs := range m {
		section, err := f.NewSection(sectionName)
		require.NoError(t, err)
		for k, v := range kvs {
			_, err := section.NewKey(k, v)
			require.NoError(t, err)
		}
	}
	return f
}
