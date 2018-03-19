package mssql

import (
	"fmt"
	"math/rand"
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
// and set up a MSSQL db named grafanatest and a user/password grafana/Password!
// Use the docker/blocks/mssql_tests/docker-compose.yaml to spin up a
// preconfigured MSSQL server suitable for running these tests.
// If needed, change the variable below to the IP address of the database.
var serverIP string = "localhost"

func TestMSSQL(t *testing.T) {
	SkipConvey("MSSQL", t, func() {
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

		fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)

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

			Convey("When doing a table query should map MSSQL column types to Go types", func() {
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

				So(column[5].(float64), ShouldEqual, 20000.15)
				So(column[6].(float64), ShouldEqual, 2.15)
				So(column[7].(float64), ShouldEqual, 12345.12)
				So(column[8].(float64), ShouldEqual, 1.1100000143051147)
				So(column[9].(float64), ShouldEqual, 2.22)
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
		})

		Convey("Given a table with metrics that lacks data for some series ", func() {
			sql := `
				IF OBJECT_ID('dbo.[metric]', 'U') IS NOT NULL
					DROP TABLE dbo.[metric]

				CREATE TABLE [metric] (
					time datetime,
					value int
				)
			`

			_, err := sess.Exec(sql)
			So(err, ShouldBeNil)

			type metric struct {
				Time  time.Time
				Value int64
			}

			series := []*metric{}
			firstRange := genTimeRangeByInterval(fromStart, 10*time.Minute, 10*time.Second)
			secondRange := genTimeRangeByInterval(fromStart.Add(20*time.Minute), 10*time.Minute, 10*time.Second)

			for _, t := range firstRange {
				series = append(series, &metric{
					Time:  t,
					Value: 15,
				})
			}

			for _, t := range secondRange {
				series = append(series, &metric{
					Time:  t,
					Value: 20,
				})
			}

			dtFormat := "2006-01-02 15:04:05.999999999"
			for _, s := range series {
				sql = fmt.Sprintf(`
					INSERT INTO metric (time, value)
					VALUES(CAST('%s' AS DATETIME), %d)
				`, s.Time.Format(dtFormat), s.Value)

				_, err = sess.Exec(sql)
				So(err, ShouldBeNil)
			}

			Convey("When doing a metric query using timeGroup", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT $__timeGroup(time, '5m') AS time, avg(value) as value FROM metric GROUP BY $__timeGroup(time, '5m') ORDER BY 1",
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
								"rawSql": "SELECT $__timeGroup(time, '5m', NULL) AS time, avg(value) as value FROM metric GROUP BY $__timeGroup(time, '5m') ORDER BY 1",
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
								"rawSql": "SELECT $__timeGroup(time, '5m', 1.5) AS time, avg(value) as value FROM metric GROUP BY $__timeGroup(time, '5m') ORDER BY 1",
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

		Convey("Given a table with metrics having multiple values and measurements", func() {
			sql := `
				IF OBJECT_ID('dbo.[metric_values]', 'U') IS NOT NULL
					DROP TABLE dbo.[metric_values]

				CREATE TABLE [metric_values] (
					time datetime,
					measurement nvarchar(100),
					valueOne int,
					valueTwo int,
				)
			`

			_, err := sess.Exec(sql)
			So(err, ShouldBeNil)

			type metricValues struct {
				Time        time.Time
				Measurement string
				ValueOne    int64
				ValueTwo    int64
			}

			rand.Seed(time.Now().Unix())
			rnd := func(min, max int64) int64 {
				return rand.Int63n(max-min) + min
			}

			series := []*metricValues{}
			for _, t := range genTimeRangeByInterval(fromStart.Add(-30*time.Minute), 90*time.Minute, 5*time.Minute) {
				series = append(series, &metricValues{
					Time:        t,
					Measurement: "Metric A",
					ValueOne:    rnd(0, 100),
					ValueTwo:    rnd(0, 100),
				})
				series = append(series, &metricValues{
					Time:        t,
					Measurement: "Metric B",
					ValueOne:    rnd(0, 100),
					ValueTwo:    rnd(0, 100),
				})
			}

			dtFormat := "2006-01-02 15:04:05"
			for _, s := range series {
				sql = fmt.Sprintf(`
					INSERT metric_values (time, measurement, valueOne, valueTwo)
					VALUES(CAST('%s' AS DATETIME), '%s', %d, %d)
				`, s.Time.Format(dtFormat), s.Measurement, s.ValueOne, s.ValueTwo)

				_, err = sess.Exec(sql)
				So(err, ShouldBeNil)
			}

			Convey("When doing a metric query grouping by time and select metric column should return correct series", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT $__timeEpoch(time), measurement + ' - value one' as metric, valueOne FROM metric_values ORDER BY 1",
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

				So(len(queryResult.Series), ShouldEqual, 2)
				So(queryResult.Series[0].Name, ShouldEqual, "Metric A - value one")
				So(queryResult.Series[1].Name, ShouldEqual, "Metric B - value one")
			})

			Convey("When doing a metric query grouping by time should return correct series", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT $__timeEpoch(time), valueOne, valueTwo FROM metric_values ORDER BY 1",
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

				So(len(queryResult.Series), ShouldEqual, 2)
				So(queryResult.Series[0].Name, ShouldEqual, "valueOne")
				So(queryResult.Series[1].Name, ShouldEqual, "valueTwo")
			})

			Convey("Given a stored procedure that takes @from and @to in epoch time", func() {
				sql := `
					IF object_id('sp_test_epoch') IS NOT NULL
						DROP PROCEDURE sp_test_epoch
				`

				_, err := sess.Exec(sql)
				So(err, ShouldBeNil)

				sql = `
					CREATE PROCEDURE sp_test_epoch(
						@from int,
						@to 	int
					)	AS
					BEGIN
						SELECT
							cast(cast(DATEDIFF(second, {d '1970-01-01'}, DATEADD(second, DATEDIFF(second,GETDATE(),GETUTCDATE()), time))/600 as int)*600 as int) as time,
							measurement + ' - value one' as metric,
							avg(valueOne) as value
						FROM
							metric_values
						WHERE
							time >= DATEADD(s, @from, '1970-01-01') AND time <= DATEADD(s, @to, '1970-01-01')
						GROUP BY
							cast(cast(DATEDIFF(second, {d '1970-01-01'}, DATEADD(second, DATEDIFF(second,GETDATE(),GETUTCDATE()), time))/600 as int)*600 as int),
							measurement
						UNION ALL
						SELECT
							cast(cast(DATEDIFF(second, {d '1970-01-01'}, DATEADD(second, DATEDIFF(second,GETDATE(),GETUTCDATE()), time))/600 as int)*600 as int) as time,
							measurement + ' - value two' as metric,
							avg(valueTwo) as value
						FROM
							metric_values
						WHERE
							time >= DATEADD(s, @from, '1970-01-01') AND time <= DATEADD(s, @to, '1970-01-01')
						GROUP BY
							cast(cast(DATEDIFF(second, {d '1970-01-01'}, DATEADD(second, DATEDIFF(second,GETDATE(),GETUTCDATE()), time))/600 as int)*600 as int),
							measurement
						ORDER BY 1
					END
				`

				_, err = sess.Exec(sql)
				So(err, ShouldBeNil)

				Convey("When doing a metric query using stored procedure should return correct result", func() {
					query := &tsdb.TsdbQuery{
						Queries: []*tsdb.Query{
							{
								Model: simplejson.NewFromAny(map[string]interface{}{
									"rawSql": `DECLARE
										@from int = $__unixEpochFrom(),
										@to int = $__unixEpochTo()

										EXEC dbo.sp_test_epoch @from, @to`,
									"format": "time_series",
								}),
								RefId: "A",
							},
						},
						TimeRange: &tsdb.TimeRange{
							From: "1521117000000",
							To:   "1521122100000",
						},
					}

					resp, err := endpoint.Query(nil, nil, query)
					queryResult := resp.Results["A"]
					So(err, ShouldBeNil)
					So(queryResult.Error, ShouldBeNil)

					So(len(queryResult.Series), ShouldEqual, 4)
					So(queryResult.Series[0].Name, ShouldEqual, "Metric A - value one")
					So(queryResult.Series[1].Name, ShouldEqual, "Metric B - value one")
					So(queryResult.Series[2].Name, ShouldEqual, "Metric A - value two")
					So(queryResult.Series[3].Name, ShouldEqual, "Metric B - value two")
				})
			})

			Convey("Given a stored procedure that takes @from and @to in datetime", func() {
				sql := `
					IF object_id('sp_test_datetime') IS NOT NULL
						DROP PROCEDURE sp_test_datetime
				`

				_, err := sess.Exec(sql)
				So(err, ShouldBeNil)

				sql = `
					CREATE PROCEDURE sp_test_datetime(
						@from datetime,
						@to 	datetime
					)	AS
					BEGIN
						SELECT
							cast(cast(DATEDIFF(second, {d '1970-01-01'}, time)/600 as int)*600 as int) as time,
							measurement + ' - value one' as metric,
							avg(valueOne) as value
						FROM
							metric_values
						WHERE
							time >= @from AND time <= @to
						GROUP BY
							cast(cast(DATEDIFF(second, {d '1970-01-01'}, time)/600 as int)*600 as int),
							measurement
						UNION ALL
						SELECT
							cast(cast(DATEDIFF(second, {d '1970-01-01'}, time)/600 as int)*600 as int) as time,
							measurement + ' - value two' as metric,
							avg(valueTwo) as value
						FROM
							metric_values
						WHERE
							time >= @from AND time <= @to
						GROUP BY
							cast(cast(DATEDIFF(second, {d '1970-01-01'}, time)/600 as int)*600 as int),
							measurement
						ORDER BY 1
					END
				`

				_, err = sess.Exec(sql)
				So(err, ShouldBeNil)

				Convey("When doing a metric query using stored procedure should return correct result", func() {
					query := &tsdb.TsdbQuery{
						Queries: []*tsdb.Query{
							{
								Model: simplejson.NewFromAny(map[string]interface{}{
									"rawSql": `DECLARE
										@from int = $__unixEpochFrom(),
										@to int = $__unixEpochTo()

										EXEC dbo.sp_test_epoch @from, @to`,
									"format": "time_series",
								}),
								RefId: "A",
							},
						},
						TimeRange: &tsdb.TimeRange{
							From: "1521117000000",
							To:   "1521122100000",
						},
					}

					resp, err := endpoint.Query(nil, nil, query)
					queryResult := resp.Results["A"]
					So(err, ShouldBeNil)
					So(queryResult.Error, ShouldBeNil)

					So(len(queryResult.Series), ShouldEqual, 4)
					So(queryResult.Series[0].Name, ShouldEqual, "Metric A - value one")
					So(queryResult.Series[1].Name, ShouldEqual, "Metric B - value one")
					So(queryResult.Series[2].Name, ShouldEqual, "Metric A - value two")
					So(queryResult.Series[3].Name, ShouldEqual, "Metric B - value two")
				})
			})
		})

		Convey("Given a table with event data", func() {
			sql := `
				IF OBJECT_ID('dbo.[event]', 'U') IS NOT NULL
					DROP TABLE dbo.[event]

				CREATE TABLE [event] (
					time_sec bigint,
					description nvarchar(100),
					tags nvarchar(100),
				)
			`

			_, err := sess.Exec(sql)
			So(err, ShouldBeNil)

			type event struct {
				TimeSec     int64
				Description string
				Tags        string
			}

			events := []*event{}
			for _, t := range genTimeRangeByInterval(fromStart.Add(-20*time.Minute), 60*time.Minute, 25*time.Minute) {
				events = append(events, &event{
					TimeSec:     t.Unix(),
					Description: "Someone deployed something",
					Tags:        "deploy",
				})
				events = append(events, &event{
					TimeSec:     t.Add(5 * time.Minute).Unix(),
					Description: "New support ticket registered",
					Tags:        "ticket",
				})
			}

			for _, e := range events {
				sql = fmt.Sprintf(`
					INSERT [event] (time_sec, description, tags)
					VALUES(%d, '%s', '%s')
				`, e.TimeSec, e.Description, e.Tags)

				_, err = sess.Exec(sql)
				So(err, ShouldBeNil)
			}

			Convey("When doing an annotation query of deploy events should return expected result", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT time_sec as time, description as [text], tags FROM [event] WHERE $__unixEpochFilter(time_sec) AND tags='deploy' ORDER BY 1 ASC",
								"format": "table",
							}),
							RefId: "Deploys",
						},
					},
					TimeRange: &tsdb.TimeRange{
						From: fmt.Sprintf("%v", fromStart.Add(-20*time.Minute).Unix()*1000),
						To:   fmt.Sprintf("%v", fromStart.Add(40*time.Minute).Unix()*1000),
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				queryResult := resp.Results["Deploys"]
				So(err, ShouldBeNil)
				So(len(queryResult.Tables[0].Rows), ShouldEqual, 3)
			})

			Convey("When doing an annotation query of ticket events should return expected result", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT time_sec as time, description as [text], tags FROM [event] WHERE $__unixEpochFilter(time_sec) AND tags='ticket' ORDER BY 1 ASC",
								"format": "table",
							}),
							RefId: "Tickets",
						},
					},
					TimeRange: &tsdb.TimeRange{
						From: fmt.Sprintf("%v", fromStart.Add(-20*time.Minute).Unix()*1000),
						To:   fmt.Sprintf("%v", fromStart.Add(40*time.Minute).Unix()*1000),
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				queryResult := resp.Results["Tickets"]
				So(err, ShouldBeNil)
				So(len(queryResult.Tables[0].Rows), ShouldEqual, 3)
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
