package postgres

import (
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/tsdb"
	_ "github.com/lib/pq"
	. "github.com/smartystreets/goconvey/convey"
)

// To run this test, remove the Skip from SkipConvey
// and set up a PostgreSQL db named grafanatest and a user/password grafanatest/grafanatest!
// Use the docker/blocks/postgres_tests/docker-compose.yaml to spin up a
// preconfigured Postgres server suitable for running these tests.
// Thers's also a dashboard.json in same directory that you can import to Grafana
// once you've created a datasource for the test server/database.
func TestPostgres(t *testing.T) {
	SkipConvey("PostgreSQL", t, func() {
		x := InitPostgresTestDB(t)

		endpoint := &PostgresQueryEndpoint{
			sqlEngine: &tsdb.DefaultSqlEngine{
				MacroEngine: NewPostgresMacroEngine(),
				XormEngine:  x,
			},
			log: log.New("tsdb.postgres"),
		}

		sess := x.NewSession()
		defer sess.Close()

		fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)

		Convey("Given a table with different native data types", func() {
			sql := `
				DROP TABLE IF EXISTS postgres_types;
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

			Convey("When doing a table query should map Postgres column types to Go types", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT * FROM postgres_types",
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				column := queryResult.Tables[0].Rows[0]
				So(column[0].(int64), ShouldEqual, 1)
				So(column[1].(int64), ShouldEqual, 2)
				So(column[2].(int64), ShouldEqual, 3)

				So(column[3].(float64), ShouldEqual, 4.5)
				So(column[4].(float64), ShouldEqual, 6.7)
				So(column[5].(float64), ShouldEqual, 1.1)
				So(column[6].(float64), ShouldEqual, 1.2)

				So(column[7].(string), ShouldEqual, "char10    ")
				So(column[8].(string), ShouldEqual, "varchar10")
				So(column[9].(string), ShouldEqual, "text")

				So(column[10].(time.Time), ShouldHaveSameTypeAs, time.Now())
				So(column[11].(time.Time), ShouldHaveSameTypeAs, time.Now())
				So(column[12].(time.Time), ShouldHaveSameTypeAs, time.Now())
				So(column[13].(time.Time), ShouldHaveSameTypeAs, time.Now())
				So(column[14].(time.Time), ShouldHaveSameTypeAs, time.Now())

				So(column[15].(string), ShouldEqual, "00:15:00")
			})
		})

		Convey("Given a table with metrics that lacks data for some series ", func() {
			sql := `
					DROP TABLE IF EXISTS metric;
					CREATE TABLE metric (
						time timestamp,
						value integer
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

			for _, s := range series {
				_, err = sess.Insert(s)
				So(err, ShouldBeNil)
			}

			Convey("When doing a metric query using timeGroup", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT $__timeGroup(time, '5m'), avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				points := queryResult.Series[0].Points
				So(len(points), ShouldEqual, 6)

				dt := fromStart

				for i := 0; i < 3; i++ {
					aValue := points[i][0].Float64
					aTime := time.Unix(int64(points[i][1].Float64)/1000, 0)
					So(aValue, ShouldEqual, 15)
					So(aTime, ShouldEqual, dt)
					dt = dt.Add(5 * time.Minute)
				}

				// adjust for 5 minute gap
				dt = dt.Add(5 * time.Minute)
				for i := 3; i < 6; i++ {
					aValue := points[i][0].Float64
					aTime := time.Unix(int64(points[i][1].Float64)/1000, 0)
					So(aValue, ShouldEqual, 20)
					So(aTime, ShouldEqual, dt)
					dt = dt.Add(5 * time.Minute)
				}
			})

			Convey("When doing a metric query using timeGroup with NULL fill enabled", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT $__timeGroup(time, '5m', NULL), avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
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
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				points := queryResult.Series[0].Points
				So(len(points), ShouldEqual, 7)

				dt := fromStart

				for i := 0; i < 3; i++ {
					aValue := points[i][0].Float64
					aTime := time.Unix(int64(points[i][1].Float64)/1000, 0)
					So(aValue, ShouldEqual, 15)
					So(aTime, ShouldEqual, dt)
					dt = dt.Add(5 * time.Minute)
				}

				So(points[3][0].Valid, ShouldBeFalse)

				// adjust for 5 minute gap
				dt = dt.Add(5 * time.Minute)
				for i := 4; i < 7; i++ {
					aValue := points[i][0].Float64
					aTime := time.Unix(int64(points[i][1].Float64)/1000, 0)
					So(aValue, ShouldEqual, 20)
					So(aTime, ShouldEqual, dt)
					dt = dt.Add(5 * time.Minute)
				}
			})

			Convey("When doing a metric query using timeGroup with float fill enabled", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT $__timeGroup(time, '5m', 1.5), avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
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
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				points := queryResult.Series[0].Points
				So(points[3][0].Float64, ShouldEqual, 1.5)
			})
		})

		Convey("Given a table with metrics having multiple values and measurements", func() {
			type metric_values struct {
				Time        time.Time
				Measurement string
				ValueOne    int64 `xorm:"integer 'valueOne'"`
				ValueTwo    int64 `xorm:"integer 'valueTwo'"`
			}

			if exist, err := sess.IsTableExist(metric_values{}); err != nil || exist {
				So(err, ShouldBeNil)
				sess.DropTable(metric_values{})
			}
			err := sess.CreateTable(metric_values{})
			So(err, ShouldBeNil)

			rand.Seed(time.Now().Unix())
			rnd := func(min, max int64) int64 {
				return rand.Int63n(max-min) + min
			}

			series := []*metric_values{}
			for _, t := range genTimeRangeByInterval(fromStart.Add(-30*time.Minute), 90*time.Minute, 5*time.Minute) {
				series = append(series, &metric_values{
					Time:        t,
					Measurement: "Metric A",
					ValueOne:    rnd(0, 100),
					ValueTwo:    rnd(0, 100),
				})
				series = append(series, &metric_values{
					Time:        t,
					Measurement: "Metric B",
					ValueOne:    rnd(0, 100),
					ValueTwo:    rnd(0, 100),
				})
			}

			for _, s := range series {
				_, err := sess.Insert(s)
				So(err, ShouldBeNil)
			}

			Convey("When doing a metric query grouping by time and select metric column should return correct series", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT $__timeEpoch(time), measurement || ' - value one' as metric, "valueOne" FROM metric_values ORDER BY 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
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
								"rawSql": `SELECT $__timeEpoch(time), "valueOne", "valueTwo" FROM metric_values ORDER BY 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				So(len(queryResult.Series), ShouldEqual, 2)
				So(queryResult.Series[0].Name, ShouldEqual, "valueOne")
				So(queryResult.Series[1].Name, ShouldEqual, "valueTwo")
			})
		})

		Convey("Given a table with event data", func() {
			type event struct {
				TimeSec     int64
				Description string
				Tags        string
			}

			if exist, err := sess.IsTableExist(event{}); err != nil || exist {
				So(err, ShouldBeNil)
				sess.DropTable(event{})
			}
			err := sess.CreateTable(event{})
			So(err, ShouldBeNil)

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
				_, err = sess.Insert(e)
				So(err, ShouldBeNil)
			}

			Convey("When doing an annotation query of deploy events should return expected result", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT "time_sec" as time, description as text, tags FROM event WHERE $__unixEpochFilter(time_sec) AND tags='deploy' ORDER BY 1 ASC`,
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
								"rawSql": `SELECT "time_sec" as time, description as text, tags FROM event WHERE $__unixEpochFilter(time_sec) AND tags='ticket' ORDER BY 1 ASC`,
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

			Convey("When doing an annotation query with a time column in datetime format", func() {
				dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)
				dtFormat := "2006-01-02 15:04:05.999999999"

				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": fmt.Sprintf(`SELECT
									CAST('%s' AS TIMESTAMP) as time,
									'message' as text,
									'tag1,tag2' as tags
								`, dt.Format(dtFormat)),
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)
				So(len(queryResult.Tables[0].Rows), ShouldEqual, 1)
				columns := queryResult.Tables[0].Rows[0]

				//Should be in milliseconds
				So(columns[0].(float64), ShouldEqual, float64(dt.Unix()*1000))
			})

			Convey("When doing an annotation query with a time column in epoch second format should return ms", func() {
				dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)

				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": fmt.Sprintf(`SELECT
									 %d as time,
									'message' as text,
									'tag1,tag2' as tags
								`, dt.Unix()),
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)
				So(len(queryResult.Tables[0].Rows), ShouldEqual, 1)
				columns := queryResult.Tables[0].Rows[0]

				//Should be in milliseconds
				So(columns[0].(int64), ShouldEqual, int64(dt.Unix()*1000))
			})

			Convey("When doing an annotation query with a time column in epoch second format (int) should return ms", func() {
				dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)

				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": fmt.Sprintf(`SELECT
									 cast(%d as bigint) as time,
									'message' as text,
									'tag1,tag2' as tags
								`, dt.Unix()),
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)
				So(len(queryResult.Tables[0].Rows), ShouldEqual, 1)
				columns := queryResult.Tables[0].Rows[0]

				//Should be in milliseconds
				So(columns[0].(int64), ShouldEqual, int64(dt.Unix()*1000))
			})

			Convey("When doing an annotation query with a time column in epoch millisecond format should return ms", func() {
				dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)

				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": fmt.Sprintf(`SELECT
									 %d as time,
									'message' as text,
									'tag1,tag2' as tags
								`, dt.Unix()*1000),
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)
				So(len(queryResult.Tables[0].Rows), ShouldEqual, 1)
				columns := queryResult.Tables[0].Rows[0]

				//Should be in milliseconds
				So(columns[0].(int64), ShouldEqual, dt.Unix()*1000)
			})

			Convey("When doing an annotation query with a time column holding a bigint null value should return nil", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT
									 cast(null as bigint) as time,
									'message' as text,
									'tag1,tag2' as tags
								`,
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)
				So(len(queryResult.Tables[0].Rows), ShouldEqual, 1)
				columns := queryResult.Tables[0].Rows[0]

				//Should be in milliseconds
				So(columns[0], ShouldBeNil)
			})

			Convey("When doing an annotation query with a time column holding a timestamp null value should return nil", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT
									 cast(null as timestamp) as time,
									'message' as text,
									'tag1,tag2' as tags
								`,
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(nil, nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)
				So(len(queryResult.Tables[0].Rows), ShouldEqual, 1)
				columns := queryResult.Tables[0].Rows[0]

				//Should be in milliseconds
				So(columns[0], ShouldBeNil)
			})
		})
	})
}

func InitPostgresTestDB(t *testing.T) *xorm.Engine {
	x, err := xorm.NewEngine(sqlutil.TestDB_Postgres.DriverName, sqlutil.TestDB_Postgres.ConnStr)
	x.DatabaseTZ = time.UTC
	x.TZLocation = time.UTC

	// x.ShowSQL()

	if err != nil {
		t.Fatalf("Failed to init postgres db %v", err)
	}

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
