package sqlstore

import (
	"context"
	"errors"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

type sqlStoreTest struct {
	name       string
	dbType     string
	dbHost     string
	dbURL      string
	dbUser     string
	dbPwd      string
	expConnStr string
	features   []string
	err        error
}

var sqlStoreTestCases = []sqlStoreTest{
	{
		name:       "MySQL IPv4",
		dbType:     "mysql",
		dbHost:     "1.2.3.4:5678",
		expConnStr: ":@tcp(1.2.3.4:5678)/test_db?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true",
	},
	{
		name:       "Postgres IPv4",
		dbType:     "postgres",
		dbHost:     "1.2.3.4:5678",
		expConnStr: "user='' host=1.2.3.4 port=5678 dbname=test_db sslmode='' sslcert='' sslkey='' sslrootcert=''",
	},
	{
		name:       "Postgres IPv4 (Default Port)",
		dbType:     "postgres",
		dbHost:     "1.2.3.4",
		expConnStr: "user='' host=1.2.3.4 port=5432 dbname=test_db sslmode='' sslcert='' sslkey='' sslrootcert=''",
	},
	{
		name:       "Postgres username and password",
		dbType:     "postgres",
		dbHost:     "1.2.3.4",
		dbUser:     "grafana",
		dbPwd:      "password",
		expConnStr: "user=grafana host=1.2.3.4 port=5432 dbname=test_db sslmode='' sslcert='' sslkey='' sslrootcert='' password=password",
	},
	{
		name:       "Postgres username no password",
		dbType:     "postgres",
		dbHost:     "1.2.3.4",
		dbUser:     "grafana",
		dbPwd:      "",
		expConnStr: "user=grafana host=1.2.3.4 port=5432 dbname=test_db sslmode='' sslcert='' sslkey='' sslrootcert=''",
	},
	{
		name:       "MySQL IPv4 (Default Port)",
		dbType:     "mysql",
		dbHost:     "1.2.3.4",
		expConnStr: ":@tcp(1.2.3.4)/test_db?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true",
	},
	{
		name:       "MySQL IPv6",
		dbType:     "mysql",
		dbHost:     "[fe80::24e8:31b2:91df:b177]:1234",
		expConnStr: ":@tcp([fe80::24e8:31b2:91df:b177]:1234)/test_db?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true",
	},
	{
		name:       "Postgres IPv6",
		dbType:     "postgres",
		dbHost:     "[fe80::24e8:31b2:91df:b177]:1234",
		expConnStr: "user='' host=fe80::24e8:31b2:91df:b177 port=1234 dbname=test_db sslmode='' sslcert='' sslkey='' sslrootcert=''",
	},
	{
		name:       "MySQL IPv6 (Default Port)",
		dbType:     "mysql",
		dbHost:     "[::1]",
		expConnStr: ":@tcp([::1])/test_db?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true",
	},
	{
		name:       "Postgres IPv6 (Default Port)",
		dbType:     "postgres",
		dbHost:     "[::1]",
		expConnStr: "user='' host=::1 port=5432 dbname=test_db sslmode='' sslcert='' sslkey='' sslrootcert=''",
	},
	{
		name:  "Invalid database URL",
		dbURL: "://invalid.com/",
		err:   &url.Error{Op: "parse", URL: "://invalid.com/", Err: errors.New("missing protocol scheme")},
	},
	{
		name:       "MySQL with ANSI_QUOTES mode",
		dbType:     "mysql",
		dbHost:     "[::1]",
		features:   []string{featuremgmt.FlagMysqlAnsiQuotes},
		expConnStr: ":@tcp([::1])/test_db?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true&sql_mode='ANSI_QUOTES'",
	},
	{
		name:       "New DB library",
		dbType:     "mysql",
		dbHost:     "[::1]",
		features:   []string{featuremgmt.FlagNewDBLibrary},
		expConnStr: ":@tcp([::1])/test_db?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true&sql_mode='ANSI_QUOTES'&parseTime=true",
	},
}

func TestIntegrationSQLConnectionString(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	for _, testCase := range sqlStoreTestCases {
		t.Run(testCase.name, func(t *testing.T) {
			sqlstore := &SQLStore{}
			sqlstore.Cfg = makeSQLStoreTestConfig(t, testCase)
			connStr, err := sqlstore.buildConnectionString()
			require.Equal(t, testCase.err, err)

			assert.Equal(t, testCase.expConnStr, connStr)
		})
	}
}

func TestIntegrationIsUniqueConstraintViolation(t *testing.T) {
	store := InitTestDB(t)

	testCases := []struct {
		desc string
		f    func(*testing.T, *DBSession) error
	}{
		{
			desc: "successfully detect primary key violations",
			f: func(t *testing.T, sess *DBSession) error {
				// Attempt to insert org with provided ID (primary key) twice
				now := time.Now()
				org := org.Org{Name: "test org primary key violation", Created: now, Updated: now, ID: 42}
				err := sess.InsertId(&org, store.Dialect)
				require.NoError(t, err)

				// Provide a different name to avoid unique constraint violation
				org.Name = "test org 2"
				return sess.InsertId(&org, store.Dialect)
			},
		},
		{
			desc: "successfully detect unique constrain violations",
			f: func(t *testing.T, sess *DBSession) error {
				// Attempt to insert org with reserved name
				now := time.Now()
				org := org.Org{Name: "test org unique constrain violation", Created: now, Updated: now, ID: 43}
				err := sess.InsertId(&org, store.Dialect)
				require.NoError(t, err)

				// Provide a different ID to avoid primary key violation
				org.ID = 44
				return sess.InsertId(&org, store.Dialect)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			err := store.WithDbSession(context.Background(), func(sess *DBSession) error {
				return tc.f(t, sess)
			})
			require.Error(t, err)
			assert.True(t, store.Dialect.IsUniqueConstraintViolation(err))
		})
	}
}

func makeSQLStoreTestConfig(t *testing.T, tc sqlStoreTest) *setting.Cfg {
	t.Helper()

	cfg := setting.NewCfg()

	sec, err := cfg.Raw.NewSection("database")
	require.NoError(t, err)
	_, err = sec.NewKey("type", tc.dbType)
	require.NoError(t, err)
	_, err = sec.NewKey("host", tc.dbHost)
	require.NoError(t, err)
	_, err = sec.NewKey("url", tc.dbURL)
	require.NoError(t, err)
	_, err = sec.NewKey("user", tc.dbUser)
	require.NoError(t, err)
	_, err = sec.NewKey("name", "test_db")
	require.NoError(t, err)
	_, err = sec.NewKey("password", tc.dbPwd)
	require.NoError(t, err)

	cfg.IsFeatureToggleEnabled = func(key string) bool {
		for _, f := range tc.features {
			if f == key {
				return true
			}
		}
		return false
	}

	return cfg
}
