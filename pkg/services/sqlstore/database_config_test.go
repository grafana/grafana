package sqlstore

import (
	"errors"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

type databaseConfigTest struct {
	name       string
	dbType     string
	dbHost     string
	dbURL      string
	dbUser     string
	dbPwd      string
	expConnStr string
	features   featuremgmt.FeatureToggles
	err        error
}

var databaseConfigTestCases = []databaseConfigTest{
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
		features:   featuremgmt.WithFeatures(featuremgmt.FlagMysqlAnsiQuotes),
		expConnStr: ":@tcp([::1])/test_db?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true&sql_mode='ANSI_QUOTES'",
	},
}

func TestIntegrationSQLConnectionString(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	for _, testCase := range databaseConfigTestCases {
		t.Run(testCase.name, func(t *testing.T) {
			cfg := makeDatabaseTestConfig(t, testCase)
			dbCfg, err := NewDatabaseConfig(cfg, testCase.features)
			require.Equal(t, testCase.err, err)
			if testCase.expConnStr != "" {
				assert.Equal(t, testCase.expConnStr, dbCfg.ConnectionString)
			}
		})
	}
}

func makeDatabaseTestConfig(t *testing.T, tc databaseConfigTest) *setting.Cfg {
	t.Helper()

	if tc.features == nil {
		tc.features = featuremgmt.WithFeatures()
	}
	// nolint:staticcheck
	cfg := setting.NewCfgWithFeatures(tc.features.IsEnabledGlobally)

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

	return cfg
}
func TestBuildConnectionStringPostgres(t *testing.T) {
	testCases := []struct {
		name            string
		dbCfg           *DatabaseConfig
		expectedConnStr string
	}{
		{
			name: "Postgres with sslmode disable",
			dbCfg: &DatabaseConfig{
				Type:    migrator.Postgres,
				User:    "grafana",
				Pwd:     "password",
				Host:    "127.0.0.1:5432",
				Name:    "grafana_test",
				SslMode: "disable",
			},
			expectedConnStr: "user=grafana host=127.0.0.1 port=5432 dbname=grafana_test sslmode=disable sslcert='' sslkey='' sslrootcert='' password=password",
		},
		{
			name: "Postgres with sslmode verify-ca",
			dbCfg: &DatabaseConfig{
				Type:           migrator.Postgres,
				User:           "grafana",
				Pwd:            "password",
				Host:           "127.0.0.1:5432",
				Name:           "grafana_test",
				SslMode:        "verify-ca",
				CaCertPath:     "/path/to/ca_cert",
				ClientKeyPath:  "/path/to/client_key",
				ClientCertPath: "/path/to/client_cert",
			},
			expectedConnStr: "user=grafana host=127.0.0.1 port=5432 dbname=grafana_test sslmode=verify-ca sslcert=/path/to/client_cert sslkey=/path/to/client_key sslrootcert=/path/to/ca_cert password=password",
		},
		{
			name: "Postgres with sslmode verify-ca without SNI",
			dbCfg: &DatabaseConfig{
				Type:           migrator.Postgres,
				User:           "grafana",
				Pwd:            "password",
				Host:           "127.0.0.1:5432",
				Name:           "grafana_test",
				SslMode:        "verify-ca",
				CaCertPath:     "/path/to/ca_cert",
				ClientKeyPath:  "/path/to/client_key",
				ClientCertPath: "/path/to/client_cert",
				SSLSNI:         "0",
			},
			expectedConnStr: "user=grafana host=127.0.0.1 port=5432 dbname=grafana_test sslmode=verify-ca sslcert=/path/to/client_cert sslkey=/path/to/client_key sslrootcert=/path/to/ca_cert sslsni=0 password=password",
		},
		{
			name: "Postgres with sslmode verify-ca with SNI",
			dbCfg: &DatabaseConfig{
				Type:           migrator.Postgres,
				User:           "grafana",
				Pwd:            "password",
				Host:           "127.0.0.1:5432",
				Name:           "grafana_test",
				SslMode:        "verify-ca",
				CaCertPath:     "/path/to/ca_cert",
				ClientKeyPath:  "/path/to/client_key",
				ClientCertPath: "/path/to/client_cert",
				SSLSNI:         "1",
			},
			expectedConnStr: "user=grafana host=127.0.0.1 port=5432 dbname=grafana_test sslmode=verify-ca sslcert=/path/to/client_cert sslkey=/path/to/client_key sslrootcert=/path/to/ca_cert sslsni=1 password=password",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.dbCfg.buildConnectionString(&setting.Cfg{}, nil)
			assert.NoError(t, err)
			assert.Equal(t, tc.expectedConnStr, tc.dbCfg.ConnectionString)
		})
	}
}

func TestValidateReplicaConfigs(t *testing.T) {
	t.Run("valid config", func(t *testing.T) {
		inicfg, err := ini.Load([]byte(testReplCfg))
		require.NoError(t, err)
		cfg, err := setting.NewCfgFromINIFile(inicfg)
		require.NoError(t, err)

		dbCfgs, err := NewRODatabaseConfigs(cfg, nil)
		require.NoError(t, err)

		err = validateReplicaConfigs(&DatabaseConfig{Type: "mysql"}, dbCfgs)
		require.NoError(t, err)
	})

	t.Run("invalid config: primary database type mismatch", func(t *testing.T) {
		// valid repl config, the issue is that the primary has a different type
		inicfg, err := ini.Load([]byte(testReplCfg))
		require.NoError(t, err)
		cfg, err := setting.NewCfgFromINIFile(inicfg)
		require.NoError(t, err)

		dbCfgs, err := NewRODatabaseConfigs(cfg, nil)
		require.NoError(t, err)

		err = validateReplicaConfigs(&DatabaseConfig{Type: "postgres"}, dbCfgs)
		require.Error(t, err)

		if uw, ok := err.(interface{ Unwrap() []error }); ok {
			errs := uw.Unwrap()
			require.Equal(t, 1, len(errs))
		}
	})

	t.Run("invalid repl config", func(t *testing.T) {
		// Type mismatch + duplicate hosts
		inicfg, err := ini.Load([]byte(invalidReplCfg))
		require.NoError(t, err)
		cfg, err := setting.NewCfgFromINIFile(inicfg)
		require.NoError(t, err)

		dbCfgs, err := NewRODatabaseConfigs(cfg, nil)
		require.NoError(t, err)

		err = validateReplicaConfigs(&DatabaseConfig{Type: "mysql"}, dbCfgs)
		require.Error(t, err)

		if uw, ok := err.(interface{ Unwrap() []error }); ok {
			errs := uw.Unwrap()
			require.Equal(t, 2, len(errs))
		}
	})
}

// This cfg has a duplicate host for repls 0 and 1, and a type mismatch in repl 2
var invalidReplCfg = `
[database_replicas]
type = mysql
name = grafana
user = grafana
password = password
host = 127.0.0.1:3306
[database_replicas.one] =
type = mysql
host = 127.0.0.1:3306
[database_replicas.two] =
type = postgres
host = 127.0.0.1:3308`
