package postgres

import (
	"testing"
  "time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

// To run this test, remove the Skip from SkipConvey
// and set up a PostgreSQL db named grafana_tests and a user/password grafana/password
func TestPostgres(t *testing.T) {
	SkipConvey("PostgreSQL", t, func() {
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
        c00_smallint smallint,
        c01_integer integer,
        c02_bigint bigint,

        c03_real real,
        c04_double double precision,
        c05_decimal decimal(10,2),
        c06_numeric numeric(10,2),

        c07_char char(10),
        c08_varchar varchar(10),
        c09_text text,

        c10_timestamp timestamp without time zone,
        c11_timestamptz timestamp with time zone,
        c12_date date,
        c13_time time without time zone,
        c14_timetz time with time zone,
        c15_interval interval
      );
    `
		_, err := sess.Exec(sql)
		So(err, ShouldBeNil)

		sql = `
      INSERT INTO postgres_types VALUES(
        1,2,3,
        4.5,6.7,1.1,1.2,
        'char10','varchar10','text',

        now(),now(),now(),now(),now(),'15m'::interval
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
			So(column[1].(int64), ShouldEqual, 2)
			So(column[2].(int64), ShouldEqual, 3)
			So(column[3].(float64), ShouldEqual, 4.5)
			So(column[4].(float64), ShouldEqual, 6.7)
      // libpq doesnt properly convert decimal, numeric and char to go types but returns []uint8 instead
//			So(column[5].(float64), ShouldEqual, 1.1)  
//			So(column[6].(float64), ShouldEqual, 1.2)
//			So(column[7].(string), ShouldEqual, "char")
			So(column[8].(string), ShouldEqual, "varchar10")
			So(column[9].(string), ShouldEqual, "text")

			So(column[10].(time.Time), ShouldHaveSameTypeAs, time.Now())
			So(column[11].(time.Time), ShouldHaveSameTypeAs, time.Now())
			So(column[12].(time.Time), ShouldHaveSameTypeAs, time.Now())
			So(column[13].(time.Time), ShouldHaveSameTypeAs, time.Now())
			So(column[14].(time.Time), ShouldHaveSameTypeAs, time.Now())

      // libpq doesnt properly convert interval to go types but returns []uint8 instead
//			So(column[15].(time.Time), ShouldHaveSameTypeAs, time.Now())
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
