// +build integration

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

type sqlStoreTest struct {
	name          string
	dbType        string
	dbHost        string
	connStrValues []string
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
		name:          "Postgres IPv4 (default port)",
		dbType:        "postgres",
		dbHost:        "1.2.3.4",
		connStrValues: []string{"host=1.2.3.4", "port=5432"},
	},
	{
		name:          "MySQL IPv4 (default port)",
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
		name:          "MySQL IPv6 (default port)",
		dbType:        "mysql",
		dbHost:        "[::1]",
		connStrValues: []string{"tcp([::1])"},
	},
	{
		name:          "Postgres IPv6 (default port)",
		dbType:        "postgres",
		dbHost:        "[::1]",
		connStrValues: []string{"host=::1", "port=5432"},
	},
	{
		name:          "Postgres Unix socket with default port",
		dbType:        "postgres",
		dbHost:        "/IAmAPath/ThatWorksDuringNewYear",
		connStrValues: []string{"host=/IAmAPath/ThatWorksDuringNewYear", "port=5432"},
	},
	{
		name:          "Postgres Unix socket with non-default port",
		dbType:        "postgres",
		dbHost:        "/IAmAPath/ThatWorksDuringNewYear:1234",
		connStrValues: []string{"host=/IAmAPath/ThatWorksDuringNewYear", "port=1234"},
	},
	{
		name:          "Postgres Unix socket with escaped colon, default port",
		dbType:        "postgres",
		dbHost:        "/IAmAPath/ThatWorksDuringNewYear/weird\\:path",
		connStrValues: []string{"host=/IAmAPath/ThatWorksDuringNewYear/weird:path", "port=5432"},
	},
	{
		name:          "Postgres Unix socket with numeric component after escaped colon, default port",
		dbType:        "postgres",
		dbHost:        "/IAmAPath/ThatWorksDuringNewYear/path\\:1234",
		connStrValues: []string{"host=/IAmAPath/ThatWorksDuringNewYear/path:1234", "port=5432"},
	},
	{
		name:          "Postgres Unix socket with escaped colon, non-default port",
		dbType:        "postgres",
		dbHost:        "/IAmAPath/ThatWorksDuringNewYear/weird\\:path:1234",
		connStrValues: []string{"host=/IAmAPath/ThatWorksDuringNewYear/weird:path", "port=1234"},
	},
	{
		name:          "Postgres Unix socket with escaped colons, default port",
		dbType:        "postgres",
		dbHost:        "/IAmAPath/ThatWorksDuringNewYear/weird\\:path\\:component",
		connStrValues: []string{"host=/IAmAPath/ThatWorksDuringNewYear/weird:path:component", "port=5432"},
	},
}

func TestSQLConnectionString(t *testing.T) {
	for _, testCase := range sqlStoreTestCases {
		t.Run(testCase.name, func(t *testing.T) {
			sqlstore := &SQLStore{}
			sqlstore.Cfg = makeSQLStoreTestConfig(t, testCase.dbType, testCase.dbHost)
			sqlstore.readConfig()

			connStr, err := sqlstore.buildConnectionString()
			require.NoError(t, err)
			for _, connSubStr := range testCase.connStrValues {
				assert.Contains(t, connStr, connSubStr)
			}
		})
	}
}

func makeSQLStoreTestConfig(t *testing.T, dbType string, host string) *setting.Cfg {
	t.Helper()

	cfg := setting.NewCfg()

	sec, err := cfg.Raw.NewSection("database")
	require.NoError(t, err)
	_, err = sec.NewKey("type", dbType)
	require.NoError(t, err)
	_, err = sec.NewKey("host", host)
	require.NoError(t, err)
	_, err = sec.NewKey("user", "user")
	require.NoError(t, err)
	_, err = sec.NewKey("name", "test_db")
	require.NoError(t, err)
	_, err = sec.NewKey("password", "pass")
	require.NoError(t, err)

	return cfg
}
