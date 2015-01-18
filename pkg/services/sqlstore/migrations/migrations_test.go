package migrations

// import (
// 	"testing"
//
// 	"github.com/go-xorm/xorm"
//
// 	. "github.com/smartystreets/goconvey/convey"
// )
//
// func TestMigrationsSqlite(t *testing.T) {
//
// 	Convey("Initial SQLite3 migration", t, func() {
// 		x, err := xorm.NewEngine("sqlite3", ":memory:")
// 		StartMigration(x)
//
// 		tables, err := x.DBMetas()
// 		So(err, ShouldBeNil)
//
// 		So(len(tables), ShouldEqual, 1)
// 	})
// }
