package migrations

import (
	"fmt"
	"testing"

	"github.com/go-xorm/xorm"

	. "github.com/smartystreets/goconvey/convey"
)

func cleanDB(x *xorm.Engine) {
	tables, _ := x.DBMetas()
	sess := x.NewSession()
	defer sess.Close()

	for _, table := range tables {
		if _, err := sess.Exec("SET FOREIGN_KEY_CHECKS = 0"); err != nil {
			panic("Failed to disable foreign key checks")
		}
		if _, err := sess.Exec("DROP TABLE " + table.Name); err != nil {
			panic(fmt.Sprintf("Failed to delete table: %v, err: %v", table.Name, err))
		}
		if _, err := sess.Exec("SET FOREIGN_KEY_CHECKS = 1"); err != nil {
			panic("Failed to disable foreign key checks")
		}
	}
}

func TestMigrationsSqlite(t *testing.T) {
	testDBs := [][]string{
		[]string{"sqlite3", ":memory:"},
		[]string{"mysql", "grafana:password@tcp(localhost:3306)/grafana_tests?charset=utf8"},
	}

	for _, testDB := range testDBs {

		Convey("Initial "+testDB[0]+" migration", t, func() {
			x, err := xorm.NewEngine(testDB[0], testDB[1])
			So(err, ShouldBeNil)

			if testDB[0] == "mysql" {
				cleanDB(x)
			}

			StartMigration(x)

			tables, err := x.DBMetas()
			So(err, ShouldBeNil)

			So(len(tables), ShouldEqual, 2)
		})

	}
}
