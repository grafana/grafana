package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

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
}

func TestSqlConnectionString(t *testing.T) {
	Convey("Testing SQL Connection Strings", t, func() {
		t.Helper()

		for _, testCase := range sqlStoreTestCases {
			Convey(testCase.name, func() {
				sqlstore := &SqlStore{}
				sqlstore.Cfg = makeSqlStoreTestConfig(testCase.dbType, testCase.dbHost)
				sqlstore.readConfig()

				connStr, err := sqlstore.buildConnectionString()

				So(err, ShouldBeNil)
				for _, connSubStr := range testCase.connStrValues {
					So(connStr, ShouldContainSubstring, connSubStr)
				}
			})
		}
	})
}

func makeSqlStoreTestConfig(dbType string, host string) *setting.Cfg {
	cfg := setting.NewCfg()

	sec, err := cfg.Raw.NewSection("database")
	So(err, ShouldBeNil)
	_, err = sec.NewKey("type", dbType)
	So(err, ShouldBeNil)
	_, err = sec.NewKey("host", host)
	So(err, ShouldBeNil)
	_, err = sec.NewKey("user", "user")
	So(err, ShouldBeNil)
	_, err = sec.NewKey("name", "test_db")
	So(err, ShouldBeNil)
	_, err = sec.NewKey("password", "pass")
	So(err, ShouldBeNil)

	return cfg
}
