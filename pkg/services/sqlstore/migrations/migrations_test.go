package migrations

import (
	"testing"

	"github.com/go-xorm/xorm"
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"

	. "github.com/smartystreets/goconvey/convey"
)

var indexTypes = []string{"Unknown", "INDEX", "UNIQUE INDEX"}

func TestMigrations(t *testing.T) {
	//log.NewLogger(0, "console", `{"level": 0}`)

	testDBs := []sqlutil.TestDB{
		sqlutil.TestDB_Sqlite3,
	}

	for _, testDB := range testDBs {

		Convey("Initial "+testDB.DriverName+" migration", t, func() {
			x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
			So(err, ShouldBeNil)

			sqlutil.CleanDB(x)

			mg := NewMigrator(x)
			//mg.LogLevel = log.DEBUG
			AddMigrations(mg)

			err = mg.Start()
			So(err, ShouldBeNil)

			// tables, err := x.DBMetas()
			// So(err, ShouldBeNil)
			//
			// fmt.Printf("\nDB Schema after migration: table count: %v\n", len(tables))
			//
			// for _, table := range tables {
			// 	fmt.Printf("\nTable: %v \n", table.Name)
			// 	for _, column := range table.Columns() {
			// 		fmt.Printf("\t %v \n", column.String(x.Dialect()))
			// 	}
			//
			// 	if len(table.Indexes) > 0 {
			// 		fmt.Printf("\n\tIndexes:\n")
			// 		for _, index := range table.Indexes {
			// 			fmt.Printf("\t %v (%v) %v \n", index.Name, strings.Join(index.Cols, ","), indexTypes[index.Type])
			// 		}
			// 	}
			// }
		})
	}
}
