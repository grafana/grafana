package migrations

import (
	"fmt"
	"strings"
	"testing"

	"github.com/go-xorm/xorm"
	"github.com/torkelo/grafana-pro/pkg/log"

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

var indexTypes = []string{"Unknown", "", "UNIQUE"}

func TestMigrations(t *testing.T) {
	log.NewLogger(0, "console", `{"level": 0}`)

	testDBs := [][]string{
		//[]string{"mysql", "grafana:password@tcp(localhost:3306)/grafana_tests?charset=utf8"},
		[]string{"sqlite3", ":memory:"},
	}

	for _, testDB := range testDBs {

		Convey("Initial "+testDB[0]+" migration", t, func() {
			x, err := xorm.NewEngine(testDB[0], testDB[1])
			So(err, ShouldBeNil)

			if testDB[0] == "mysql" {
				cleanDB(x)
			}

			mg := NewMigrator(x)
			AddMigrations(mg)

			err = mg.Start()
			So(err, ShouldBeNil)

			tables, err := x.DBMetas()
			So(err, ShouldBeNil)

			//So(len(tables), ShouldEqual, 2)
			fmt.Printf("\nDB Schema after migration: table count: %v\n", len(tables))

			for _, table := range tables {
				fmt.Printf("\nTable: %v \n", table.Name)
				for _, column := range table.Columns() {
					fmt.Printf("\t %v \n", column.String(x.Dialect()))
				}

				if len(table.Indexes) > 0 {
					fmt.Printf("\n\tIndexes:\n")
					for _, index := range table.Indexes {
						fmt.Printf("\t %v (%v) %v \n", index.Name, strings.Join(index.Cols, ","), indexTypes[index.Type])
					}
				}
			}
		})
	}
}
