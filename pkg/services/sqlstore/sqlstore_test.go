package sqlstore

import (
	"errors"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

type sqlStoreTest struct {
	name          string
	dbType        string
	dbHost        string
	dbURL         string
	connStrValues []string
	err           error
}

var sqlStoreTestCases = []sqlStoreTest{
	{
		name:          "MySQL IPv4",
		dbType:        "mysql",
		dbHost:        "1.2.3.4:5678",
		connStrValues: []string{"tcp(1.2.3.4:5678)"},
	},
	{
		name:          "Postgres IPv4",
		dbType:        "postgres",
		dbHost:        "1.2.3.4:5678",
		connStrValues: []string{"host=1.2.3.4", "port=5678"},
	},
	{
		name:          "Postgres IPv4 (Default Port)",
		dbType:        "postgres",
		dbHost:        "1.2.3.4",
		connStrValues: []string{"host=1.2.3.4", "port=5432"},
	},
	{
		name:          "MySQL IPv4 (Default Port)",
		dbType:        "mysql",
		dbHost:        "1.2.3.4",
		connStrValues: []string{"tcp(1.2.3.4)"},
	},
	{
		name:          "MySQL IPv6",
		dbType:        "mysql",
		dbHost:        "[fe80::24e8:31b2:91df:b177]:1234",
		connStrValues: []string{"tcp([fe80::24e8:31b2:91df:b177]:1234)"},
	},
	{
		name:          "Postgres IPv6",
		dbType:        "postgres",
		dbHost:        "[fe80::24e8:31b2:91df:b177]:1234",
		connStrValues: []string{"host=fe80::24e8:31b2:91df:b177", "port=1234"},
	},
	{
		name:          "MySQL IPv6 (Default Port)",
		dbType:        "mysql",
		dbHost:        "[::1]",
		connStrValues: []string{"tcp([::1])"},
	},
	{
		name:          "Postgres IPv6 (Default Port)",
		dbType:        "postgres",
		dbHost:        "[::1]",
		connStrValues: []string{"host=::1", "port=5432"},
	},
	{
		name:  "Invalid database URL",
		dbURL: "://invalid.com/",
		err:   &url.Error{Op: "parse", URL: "://invalid.com/", Err: errors.New("missing protocol scheme")},
	},
	{
		name:          "Sql mode set to ANSI_QUOTES",
		dbType:        "mysql",
		dbHost:        "[::1]",
		connStrValues: []string{"sql_mode='ANSI_QUOTES'"},
	},
}

func TestIntegrationSQLConnectionString(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	for _, testCase := range sqlStoreTestCases {
		t.Run(testCase.name, func(t *testing.T) {
			sqlstore := &SQLStore{}
			sqlstore.Cfg = makeSQLStoreTestConfig(t, testCase.dbType, testCase.dbHost, testCase.dbURL)
			connStr, err := sqlstore.buildConnectionString()
			require.Equal(t, testCase.err, err)

			for _, connSubStr := range testCase.connStrValues {
				require.Contains(t, connStr, connSubStr)
			}
		})
	}
}

func makeSQLStoreTestConfig(t *testing.T, dbType, host, dbURL string) *setting.Cfg {
	t.Helper()

	cfg := setting.NewCfg()

	sec, err := cfg.Raw.NewSection("database")
	require.NoError(t, err)
	_, err = sec.NewKey("type", dbType)
	require.NoError(t, err)
	_, err = sec.NewKey("host", host)
	require.NoError(t, err)
	_, err = sec.NewKey("url", dbURL)
	require.NoError(t, err)
	_, err = sec.NewKey("user", "user")
	require.NoError(t, err)
	_, err = sec.NewKey("name", "test_db")
	require.NoError(t, err)
	_, err = sec.NewKey("password", "pass")
	require.NoError(t, err)

	cfg.IsFeatureToggleEnabled = func(key string) bool { return true }

	return cfg
}
