package mssql

import (
	"fmt"
	"strings"
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
// and set up a MSSQL db named grafana_tests and a user/password grafana/Password!
// and set the variable below to the IP address of the database
var serverIP string = "localhost"

func TestMSSQL(t *testing.T) {
	Convey("MSSQL", t, func() {
		x := InitMSSQLTestDB(t)

		endpoint := &MssqlQueryEndpoint{
			sqlEngine: &tsdb.DefaultSqlEngine{
				MacroEngine: NewMssqlMacroEngine(),
				XormEngine:  x,
			},
			log: log.New("tsdb.mssql"),
		}

		sess := x.NewSession()
		defer sess.Close()

		Convey("Given a table with different native data types", func() {
			sql := `
				IF OBJECT_ID('dbo.[mssql_types]', 'U') IS NOT NULL
					DROP TABLE dbo.[mssql_types]

				CREATE TABLE [mssql_types] (
					c_bit bit,
					c_tinyint tinyint,
					c_smallint smallint,
					c_int int,
					c_bigint bigint,
					c_money money,
					c_smallmoney smallmoney,
					c_numeric numeric(10,5),

					c_real real,
					c_decimal decimal(10,2),
					c_float float,

					c_char char(10),
					c_varchar varchar(10),
					c_text text,

					c_nchar nchar(12),
					c_nvarchar nvarchar(12),
					c_ntext ntext,

					c_datetime datetime,
					c_datetime2 datetime2,
					c_smalldatetime smalldatetime,
					c_date date,
					c_time time,
					c_datetimeoffset datetimeoffset
				)
			`

			_, err := sess.Exec(sql)
			So(err, ShouldBeNil)

			dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)
			dtFormat := "2006-01-02 15:04:05.999999999"
			d := dt.Format(dtFormat)
			dt2 := time.Date(2018, 3, 14, 21, 20, 6, 8896406e2, time.UTC)
			dt2Format := "2006-01-02 15:04:05.999999999 -07:00"
			d2 := dt2.Format(dt2Format)

			sql = fmt.Sprintf(`
			INSERT INTO [mssql_types]
			SELECT
        1, 5, 20020, 980300, 1420070400, '$20000.15', '£2.15', 12345.12,
        1.11, 2.22, 3.33,
				'char10', 'varchar10', 'text',
				N'☺nchar12☺', N'☺nvarchar12☺', N'☺text☺',
			  CAST('%s' AS DATETIME), CAST('%s' AS DATETIME2), CAST('%s' AS SMALLDATETIME), CAST('%s' AS DATE), CAST('%s' AS TIME), SWITCHOFFSET(CAST('%s' AS DATETIMEOFFSET), '-07:00')
    `, d, d2, d, d, d, d2)

			_, err = sess.Exec(sql)
			So(err, ShouldBeNil)

			Convey("Query with Table format should map MSSQL column types to Go types", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT * FROM mssql_types",
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				queryResult := resp.Results["A"]
				So(err, ShouldBeNil)

				column := queryResult.Tables[0].Rows[0]

				So(column[0].(bool), ShouldEqual, true)
				So(column[1].(int64), ShouldEqual, 5)
				So(column[2].(int64), ShouldEqual, 20020)
				So(column[3].(int64), ShouldEqual, 980300)
				So(column[4].(int64), ShouldEqual, 1420070400)
				// So(column[5].(float64), ShouldEqual, 20000.15)
				// So(column[6].(float64), ShouldEqual, 2.15)
				//So(column[7].(float64), ShouldEqual, 12345.12)

				So(column[8].(float64), ShouldEqual, 1.1100000143051147) // MSSQL dose not have precision for "real" datatype
				// fix me: MSSQL driver puts the decimal inside an array of chars. and the test fails despite the values are correct.
				//So(column[9].([]uint8), ShouldEqual, []uint8{'2', '.', '2', '2'})
				So(column[10].(float64), ShouldEqual, 3.33)

				So(column[11].(string), ShouldEqual, "char10    ")
				So(column[12].(string), ShouldEqual, "varchar10")
				So(column[13].(string), ShouldEqual, "text")

				So(column[14].(string), ShouldEqual, "☺nchar12☺   ")
				So(column[15].(string), ShouldEqual, "☺nvarchar12☺")
				So(column[16].(string), ShouldEqual, "☺text☺")

				So(column[17].(time.Time), ShouldEqual, dt)
				So(column[18].(time.Time), ShouldEqual, dt2)
				So(column[19].(time.Time), ShouldEqual, dt.Truncate(time.Minute))
				So(column[20].(time.Time), ShouldEqual, dt.Truncate(24*time.Hour))
				So(column[21].(time.Time), ShouldEqual, time.Date(1, 1, 1, dt.Hour(), dt.Minute(), dt.Second(), dt.Nanosecond(), time.UTC))
				So(column[22].(time.Time), ShouldEqual, dt2.In(time.FixedZone("UTC", int(-7*time.Hour))))
			})

			// Convey("stored procedure", func() {
			// 	sql := `
			// 	create procedure dbo.test_sp as
			// 	begin
			// 		select 1
			// 	end
			// `
			// 	sess.Exec(sql)

			// 	sql = `
			// 	ALTER PROCEDURE dbo.test_sp
			// 		@from int,
			// 		@to 	int
			// 	AS
			// 	BEGIN
			// 		select
			// 			GETDATE() AS Time,
			// 			1 as value,
			// 			'metric' as metric
			// 	END
			// `
			// 	_, err := sess.Exec(sql)
			// 	So(err, ShouldBeNil)

			// 	sql = `
			// 	EXEC dbo.test_sp 1, 2
			// `
			// 	_, err = sess.Exec(sql)
			// 	So(err, ShouldBeNil)
			// })
		})

		Convey("Given a table with metrics", func() {
			sql := `
				IF OBJECT_ID('dbo.[metric]', 'U') IS NOT NULL
					DROP TABLE dbo.[metric]

				CREATE TABLE [metric] (
					time datetime,
					measurement nvarchar(100),
					value int
				)
			`

			_, err := sess.Exec(sql)
			So(err, ShouldBeNil)

			type metric struct {
				Time        time.Time
				Measurement string
				Value       int64
			}

			series := []*metric{}

			fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)
			firstRange := genTimeRangeByInterval(fromStart, 10*time.Minute, 10*time.Second)
			secondRange := genTimeRangeByInterval(fromStart.Add(20*time.Minute), 10*time.Minute, 10*time.Second)

			for _, t := range firstRange {
				series = append(series, &metric{
					Time:        t,
					Measurement: "test",
					Value:       15,
				})
			}

			for _, t := range secondRange {
				series = append(series, &metric{
					Time:        t,
					Measurement: "test",
					Value:       20,
				})
			}

			dtFormat := "2006-01-02 15:04:05.999999999"
			for _, s := range series {
				sql = fmt.Sprintf(`
					INSERT INTO metric (time, measurement, value)
					VALUES(CAST('%s' AS DATETIME), '%s', %d)
				`, s.Time.Format(dtFormat), s.Measurement, s.Value)

				_, err = sess.Exec(sql)
				So(err, ShouldBeNil)
			}

			Convey("When doing a metric query using timeGroup", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT $__timeGroup(time, '5m') AS time, measurement as metric, avg(value) as value FROM metric GROUP BY $__timeGroup(time, '5m'), measurement ORDER BY 1",
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				queryResult := resp.Results["A"]
				So(err, ShouldBeNil)
				So(queryResult.Error, ShouldBeNil)

				points := queryResult.Series[0].Points

				So(len(points), ShouldEqual, 4)
				actualValueFirst := points[0][0].Float64
				actualTimeFirst := time.Unix(int64(points[0][1].Float64)/1000, 0)
				So(actualValueFirst, ShouldEqual, 15)
				So(actualTimeFirst, ShouldEqual, fromStart)

				actualValueLast := points[3][0].Float64
				actualTimeLast := time.Unix(int64(points[3][1].Float64)/1000, 0)
				So(actualValueLast, ShouldEqual, 20)
				So(actualTimeLast, ShouldEqual, fromStart.Add(25*time.Minute))
			})

			Convey("When doing a metric query using timeGroup with NULL fill enabled", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT $__timeGroup(time, '5m', NULL) AS time, measurement as metric, avg(value) as value FROM metric GROUP BY $__timeGroup(time, '5m'), measurement ORDER BY 1",
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
					TimeRange: &tsdb.TimeRange{
						From: fmt.Sprintf("%v", fromStart.Unix()*1000),
						To:   fmt.Sprintf("%v", fromStart.Add(34*time.Minute).Unix()*1000),
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				queryResult := resp.Results["A"]
				So(err, ShouldBeNil)
				So(queryResult.Error, ShouldBeNil)

				points := queryResult.Series[0].Points

				So(len(points), ShouldEqual, 7)
				actualValueFirst := points[0][0].Float64
				actualTimeFirst := time.Unix(int64(points[0][1].Float64)/1000, 0)
				So(actualValueFirst, ShouldEqual, 15)
				So(actualTimeFirst, ShouldEqual, fromStart)

				actualNullPoint := points[3][0]
				actualNullTime := time.Unix(int64(points[3][1].Float64)/1000, 0)
				So(actualNullPoint.Valid, ShouldBeFalse)
				So(actualNullTime, ShouldEqual, fromStart.Add(15*time.Minute))

				actualValueLast := points[5][0].Float64
				actualTimeLast := time.Unix(int64(points[5][1].Float64)/1000, 0)
				So(actualValueLast, ShouldEqual, 20)
				So(actualTimeLast, ShouldEqual, fromStart.Add(25*time.Minute))

				actualLastNullPoint := points[6][0]
				actualLastNullTime := time.Unix(int64(points[6][1].Float64)/1000, 0)
				So(actualLastNullPoint.Valid, ShouldBeFalse)
				So(actualLastNullTime, ShouldEqual, fromStart.Add(30*time.Minute))

			})

			Convey("When doing a metric query using timeGroup with float fill enabled", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT $__timeGroup(time, '5m', 1.5) AS time, measurement as metric, avg(value) as value FROM metric GROUP BY $__timeGroup(time, '5m'), measurement ORDER BY 1",
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
					TimeRange: &tsdb.TimeRange{
						From: fmt.Sprintf("%v", fromStart.Unix()*1000),
						To:   fmt.Sprintf("%v", fromStart.Add(34*time.Minute).Unix()*1000),
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				queryResult := resp.Results["A"]
				So(err, ShouldBeNil)
				So(queryResult.Error, ShouldBeNil)

				points := queryResult.Series[0].Points

				So(points[6][0].Float64, ShouldEqual, 1.5)
			})
		})
	})
}

func InitMSSQLTestDB(t *testing.T) *xorm.Engine {
	x, err := xorm.NewEngine(sqlutil.TestDB_Mssql.DriverName, strings.Replace(sqlutil.TestDB_Mssql.ConnStr, "localhost", serverIP, 1))

	// x.ShowSQL()

	if err != nil {
		t.Fatalf("Failed to init mssql db %v", err)
	}

	sqlutil.CleanDB(x)

	return x
}

func genTimeRangeByInterval(from time.Time, duration time.Duration, interval time.Duration) []time.Time {
	durationSec := int64(duration.Seconds())
	intervalSec := int64(interval.Seconds())
	timeRange := []time.Time{}

	for i := int64(0); i < durationSec; i += intervalSec {
		timeRange = append(timeRange, from)
		from = from.Add(time.Duration(int64(time.Second) * intervalSec))
	}

	return timeRange
}
