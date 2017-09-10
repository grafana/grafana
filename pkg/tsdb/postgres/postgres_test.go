package postgres

import (
	"testing"

  _ "github.com/lib/pq"
	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

// To run this test, remove the Skip from SkipConvey
// and set up a MySQL db named grafana_tests and a user/password grafana/password
func TestPostgres(t *testing.T) {
	Convey("PostgreSQL", t, func() {
		x := InitPostgresTestDB(t)

		executor := &PostgresExecutor{
			engine: x,
			log:    log.New("tsdb.postgres"),
		}

		sess := x.NewSession()
		defer sess.Close()
		db := sess.DB()

		sql := `
      CREATE TABLE postgres_types(
        aint int
      );
    `
		_, err := sess.Exec(sql)
		So(err, ShouldBeNil)

		sql = `
      INSERT INTO postgres_types VALUES(
        1
      );
    `
		_, err = sess.Exec(sql)
		So(err, ShouldBeNil)

		Convey("TransformToTable should map PostgreSQL column types to Go types", func() {
			rows, err := db.Query("SELECT * FROM postgres_types")
			defer rows.Close()
			So(err, ShouldBeNil)

			queryResult := &tsdb.QueryResult{Meta: simplejson.New()}
			err = executor.TransformToTable(nil, rows, queryResult)
			So(err, ShouldBeNil)
			column := queryResult.Tables[0].Rows[0]
			So(column[0].(int64), ShouldEqual, 1)
//			So(*column[1].(*string), ShouldEqual, "abc")
//			So(*column[2].(*string), ShouldEqual, "def")
//			So(*column[3].(*int32), ShouldEqual, 1)
//			So(*column[4].(*int16), ShouldEqual, 10)
//			So(*column[5].(*int64), ShouldEqual, 100)
//			So(*column[6].(*int), ShouldEqual, 1420070400)
//			So(*column[7].(*float64), ShouldEqual, 1.11)
//			So(*column[8].(*float64), ShouldEqual, 2.22)
//			So(*column[9].(*float64), ShouldEqual, 3.33)
//			_, offset := time.Now().Zone()
//			So((*column[10].(*time.Time)), ShouldHappenWithin, time.Duration(10*time.Second), time.Now().Add(time.Duration(offset)*time.Second))
//			So(*column[11].(*time.Time), ShouldHappenWithin, time.Duration(10*time.Second), time.Now().Add(time.Duration(offset)*time.Second))
//			So(*column[12].(*string), ShouldEqual, "11:11:11")
//			So(*column[13].(*[]byte), ShouldHaveSameTypeAs, []byte{1})
//			So(*column[14].(*string), ShouldEqual, "tinytext")
//			So(*column[15].(*string), ShouldEqual, "tinyblob")
//			So(*column[16].(*string), ShouldEqual, "text")
//			So(*column[17].(*string), ShouldEqual, "blob")
//			So(*column[18].(*string), ShouldEqual, "mediumtext")
//			So(*column[19].(*string), ShouldEqual, "mediumblob")
//			So(*column[20].(*string), ShouldEqual, "longtext")
//			So(*column[21].(*string), ShouldEqual, "longblob")
//			So(*column[22].(*string), ShouldEqual, "val2")
//			So(*column[23].(*string), ShouldEqual, "a,b")
//			So(*column[24].(*string), ShouldEqual, time.Now().Format("2006-01-02T00:00:00Z"))
		})
	})
}

func InitPostgresTestDB(t *testing.T) *xorm.Engine {
	x, err := xorm.NewEngine(sqlutil.TestDB_Postgres.DriverName, sqlutil.TestDB_Postgres.ConnStr)

	// x.ShowSQL()

	if err != nil {
		t.Fatalf("Failed to init postgres db %v", err)
	}

	sqlutil.CleanDB(x)

	return x
}
