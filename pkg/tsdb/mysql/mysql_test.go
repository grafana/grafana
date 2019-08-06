package mysql

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"testing"
	"time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

// To run this test, set runMySqlTests=true
// Or from the commandline: GRAFANA_TEST_DB=mysql go test -v ./pkg/tsdb/mysql
// The tests require a MySQL db named grafana_ds_tests and a user/password grafana/password
// Use the docker/blocks/mysql_tests/docker-compose.yaml to spin up a
// preconfigured MySQL server suitable for running these tests.
// There is also a datasource and dashboard provisioned by devenv scripts that you can
// use to verify that the generated data are vizualized as expected, see
// devenv/README.md for setup instructions.
func TestMySQL(t *testing.T) {
	// change to true to run the MySQL tests
	runMySqlTests := false
	// runMySqlTests := true

	if !(sqlstore.IsTestDbMySql() || runMySqlTests) {
		t.Skip()
	}

	Convey("MySQL", t, func() {
		x := InitMySQLTestDB(t)

		origXormEngine := tsdb.NewXormEngine
		tsdb.NewXormEngine = func(d, c string) (*xorm.Engine, error) {
			return x, nil
		}

		origInterpolate := tsdb.Interpolate
		tsdb.Interpolate = func(query *tsdb.Query, timeRange *tsdb.TimeRange, sql string) (string, error) {
			return sql, nil
		}

		endpoint, err := newMysqlQueryEndpoint(&models.DataSource{
			JsonData:       simplejson.New(),
			SecureJsonData: securejsondata.SecureJsonData{},
		})
		So(err, ShouldBeNil)

		sess := x.NewSession()
		fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)

		Reset(func() {
			sess.Close()
			tsdb.NewXormEngine = origXormEngine
			tsdb.Interpolate = origInterpolate
		})

		Convey("Given a table with different native data types", func() {
			if exists, err := sess.IsTableExist("mysql_types"); err != nil || exists {
				So(err, ShouldBeNil)
				sess.DropTable("mysql_types")
			}

			sql := "CREATE TABLE `mysql_types` ("
			sql += "`atinyint` tinyint(1) NOT NULL,"
			sql += "`avarchar` varchar(3) NOT NULL,"
			sql += "`achar` char(3),"
			sql += "`amediumint` mediumint NOT NULL,"
			sql += "`asmallint` smallint NOT NULL,"
			sql += "`abigint` bigint NOT NULL,"
			sql += "`aint` int(11) NOT NULL,"
			sql += "`adouble` double(10,2),"
			sql += "`anewdecimal` decimal(10,2),"
			sql += "`afloat` float(10,2) NOT NULL,"
			sql += "`atimestamp` timestamp NOT NULL,"
			sql += "`adatetime` datetime NOT NULL,"
			sql += "`atime` time NOT NULL,"
			sql += "`ayear` year," // Crashes xorm when running cleandb
			sql += "`abit` bit(1),"
			sql += "`atinytext` tinytext,"
			sql += "`atinyblob` tinyblob,"
			sql += "`atext` text,"
			sql += "`ablob` blob,"
			sql += "`amediumtext` mediumtext,"
			sql += "`amediumblob` mediumblob,"
			sql += "`alongtext` longtext,"
			sql += "`alongblob` longblob,"
			sql += "`aenum` enum('val1', 'val2'),"
			sql += "`aset` set('a', 'b', 'c', 'd'),"
			sql += "`adate` date,"
			sql += "`time_sec` datetime(6),"
			sql += "`aintnull` int(11),"
			sql += "`afloatnull` float(10,2),"
			sql += "`avarcharnull` varchar(3),"
			sql += "`adecimalnull` decimal(10,2)"
			sql += ") ENGINE=InnoDB DEFAULT CHARSET=latin1;"
			_, err := sess.Exec(sql)
			So(err, ShouldBeNil)

			sql = "INSERT INTO `mysql_types` "
			sql += "(`atinyint`, `avarchar`, `achar`, `amediumint`, `asmallint`, `abigint`, `aint`, `adouble`, "
			sql += "`anewdecimal`, `afloat`, `adatetime`, `atimestamp`, `atime`, `ayear`, `abit`, `atinytext`, "
			sql += "`atinyblob`, `atext`, `ablob`, `amediumtext`, `amediumblob`, `alongtext`, `alongblob`, "
			sql += "`aenum`, `aset`, `adate`, `time_sec`) "
			sql += "VALUES(1, 'abc', 'def', 1, 10, 100, 1420070400, 1.11, "
			sql += "2.22, 3.33, now(), current_timestamp(), '11:11:11', '2018', 1, 'tinytext', "
			sql += "'tinyblob', 'text', 'blob', 'mediumtext', 'mediumblob', 'longtext', 'longblob', "
			sql += "'val2', 'a,b', curdate(), '2018-01-01 00:01:01.123456');"
			_, err = sess.Exec(sql)
			So(err, ShouldBeNil)

			Convey("Query with Table format should map MySQL column types to Go types", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT * FROM mysql_types",
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				column := queryResult.Tables[0].Rows[0]

				So(*column[0].(*int8), ShouldEqual, 1)
				So(column[1].(string), ShouldEqual, "abc")
				So(column[2].(string), ShouldEqual, "def")
				So(*column[3].(*int32), ShouldEqual, 1)
				So(*column[4].(*int16), ShouldEqual, 10)
				So(*column[5].(*int64), ShouldEqual, 100)
				So(*column[6].(*int32), ShouldEqual, 1420070400)
				So(column[7].(float64), ShouldEqual, 1.11)
				So(column[8].(float64), ShouldEqual, 2.22)
				So(*column[9].(*float32), ShouldEqual, 3.33)
				So(column[10].(time.Time), ShouldHappenWithin, 10*time.Second, time.Now())
				So(column[11].(time.Time), ShouldHappenWithin, 10*time.Second, time.Now())
				So(column[12].(string), ShouldEqual, "11:11:11")
				So(column[13].(int64), ShouldEqual, 2018)
				So(*column[14].(*[]byte), ShouldHaveSameTypeAs, []byte{1})
				So(column[15].(string), ShouldEqual, "tinytext")
				So(column[16].(string), ShouldEqual, "tinyblob")
				So(column[17].(string), ShouldEqual, "text")
				So(column[18].(string), ShouldEqual, "blob")
				So(column[19].(string), ShouldEqual, "mediumtext")
				So(column[20].(string), ShouldEqual, "mediumblob")
				So(column[21].(string), ShouldEqual, "longtext")
				So(column[22].(string), ShouldEqual, "longblob")
				So(column[23].(string), ShouldEqual, "val2")
				So(column[24].(string), ShouldEqual, "a,b")
				So(column[25].(time.Time).Format("2006-01-02T00:00:00Z"), ShouldEqual, time.Now().UTC().Format("2006-01-02T00:00:00Z"))
				So(column[26].(float64), ShouldEqual, float64(1.514764861123456*1e12))
				So(column[27], ShouldEqual, nil)
				So(column[28], ShouldEqual, nil)
				So(column[29], ShouldEqual, "")
				So(column[30], ShouldEqual, nil)
			})
		})

		Convey("Given a table with metrics that lacks data for some series ", func() {
			type metric struct {
				Time  time.Time
				Value int64
			}

			if exist, err := sess.IsTableExist(metric{}); err != nil || exist {
				So(err, ShouldBeNil)
				sess.DropTable(metric{})
			}
			err := sess.CreateTable(metric{})
			So(err, ShouldBeNil)

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

			_, err = sess.InsertMulti(series)
			So(err, ShouldBeNil)

			Convey("When doing a metric query using timeGroup", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT $__timeGroup(time, '5m') as time_sec, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				points := queryResult.Series[0].Points
				// without fill this should result in 4 buckets
				So(len(points), ShouldEqual, 4)

				dt := fromStart

				for i := 0; i < 2; i++ {
					aValue := points[i][0].Float64
					aTime := time.Unix(int64(points[i][1].Float64)/1000, 0)
					So(aValue, ShouldEqual, 15)
					So(aTime, ShouldEqual, dt)
					dt = dt.Add(5 * time.Minute)
				}

				// adjust for 10 minute gap between first and second set of points
				dt = dt.Add(10 * time.Minute)
				for i := 2; i < 4; i++ {
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
								"rawSql": "SELECT $__timeGroup(time, '5m', NULL) as time_sec, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
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

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				points := queryResult.Series[0].Points
				So(len(points), ShouldEqual, 7)

				dt := fromStart

				for i := 0; i < 2; i++ {
					aValue := points[i][0].Float64
					aTime := time.Unix(int64(points[i][1].Float64)/1000, 0)
					So(aValue, ShouldEqual, 15)
					So(aTime, ShouldEqual, dt)
					dt = dt.Add(5 * time.Minute)
				}

				// check for NULL values inserted by fill
				So(points[2][0].Valid, ShouldBeFalse)
				So(points[3][0].Valid, ShouldBeFalse)

				// adjust for 10 minute gap between first and second set of points
				dt = dt.Add(10 * time.Minute)
				for i := 4; i < 6; i++ {
					aValue := points[i][0].Float64
					aTime := time.Unix(int64(points[i][1].Float64)/1000, 0)
					So(aValue, ShouldEqual, 20)
					So(aTime, ShouldEqual, dt)
					dt = dt.Add(5 * time.Minute)
				}

				// check for NULL values inserted by fill
				So(points[6][0].Valid, ShouldBeFalse)

			})

			Convey("When doing a metric query using timeGroup and $__interval", func() {
				mockInterpolate := tsdb.Interpolate
				tsdb.Interpolate = origInterpolate

				Reset(func() {
					tsdb.Interpolate = mockInterpolate
				})

				Convey("Should replace $__interval", func() {
					query := &tsdb.TsdbQuery{
						Queries: []*tsdb.Query{
							{
								DataSource: &models.DataSource{JsonData: simplejson.New()},
								Model: simplejson.NewFromAny(map[string]interface{}{
									"rawSql": "SELECT $__timeGroup(time, $__interval) AS time, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
									"format": "time_series",
								}),
								RefId: "A",
							},
						},
						TimeRange: &tsdb.TimeRange{
							From: fmt.Sprintf("%v", fromStart.Unix()*1000),
							To:   fmt.Sprintf("%v", fromStart.Add(30*time.Minute).Unix()*1000),
						},
					}

					resp, err := endpoint.Query(context.Background(), nil, query)
					So(err, ShouldBeNil)
					queryResult := resp.Results["A"]
					So(queryResult.Error, ShouldBeNil)
					So(queryResult.Meta.Get("sql").MustString(), ShouldEqual, "SELECT UNIX_TIMESTAMP(time) DIV 60 * 60 AS time, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1")
				})
			})

			Convey("When doing a metric query using timeGroup with value fill enabled", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT $__timeGroup(time, '5m', 1.5) as time_sec, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
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

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				points := queryResult.Series[0].Points
				So(points[3][0].Float64, ShouldEqual, 1.5)
			})

			Convey("When doing a metric query using timeGroup with previous fill enabled", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": "SELECT $__timeGroup(time, '5m', previous) as time_sec, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
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

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				points := queryResult.Series[0].Points
				So(points[2][0].Float64, ShouldEqual, 15.0)
				So(points[3][0].Float64, ShouldEqual, 15.0)
				So(points[6][0].Float64, ShouldEqual, 20.0)
			})

		})

		Convey("Given a table with metrics having multiple values and measurements", func() {
			type metric_values struct {
				Time                time.Time  `xorm:"datetime 'time' not null"`
				TimeNullable        *time.Time `xorm:"datetime(6) 'timeNullable' null"`
				TimeInt64           int64      `xorm:"bigint(20) 'timeInt64' not null"`
				TimeInt64Nullable   *int64     `xorm:"bigint(20) 'timeInt64Nullable' null"`
				TimeFloat64         float64    `xorm:"double 'timeFloat64' not null"`
				TimeFloat64Nullable *float64   `xorm:"double 'timeFloat64Nullable' null"`
				TimeInt32           int32      `xorm:"int(11) 'timeInt32' not null"`
				TimeInt32Nullable   *int32     `xorm:"int(11) 'timeInt32Nullable' null"`
				TimeFloat32         float32    `xorm:"double 'timeFloat32' not null"`
				TimeFloat32Nullable *float32   `xorm:"double 'timeFloat32Nullable' null"`
				Measurement         string
				ValueOne            int64 `xorm:"integer 'valueOne'"`
				ValueTwo            int64 `xorm:"integer 'valueTwo'"`
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

			var tInitial time.Time

			series := []*metric_values{}
			for i, t := range genTimeRangeByInterval(fromStart.Add(-30*time.Minute), 90*time.Minute, 5*time.Minute) {
				if i == 0 {
					tInitial = t
				}
				tSeconds := t.Unix()
				tSecondsInt32 := int32(tSeconds)
				tSecondsFloat32 := float32(tSeconds)
				tMilliseconds := tSeconds * 1e3
				tMillisecondsFloat := float64(tMilliseconds)
				t2 := t
				first := metric_values{
					Time:                t,
					TimeNullable:        &t2,
					TimeInt64:           tMilliseconds,
					TimeInt64Nullable:   &(tMilliseconds),
					TimeFloat64:         tMillisecondsFloat,
					TimeFloat64Nullable: &tMillisecondsFloat,
					TimeInt32:           tSecondsInt32,
					TimeInt32Nullable:   &tSecondsInt32,
					TimeFloat32:         tSecondsFloat32,
					TimeFloat32Nullable: &tSecondsFloat32,
					Measurement:         "Metric A",
					ValueOne:            rnd(0, 100),
					ValueTwo:            rnd(0, 100),
				}
				second := first
				second.Measurement = "Metric B"
				second.ValueOne = rnd(0, 100)
				second.ValueTwo = rnd(0, 100)

				series = append(series, &first)
				series = append(series, &second)
			}

			_, err = sess.InsertMulti(series)
			So(err, ShouldBeNil)

			Convey("When doing a metric query using time as time column should return metric with time in milliseconds", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT time, valueOne FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				So(len(queryResult.Series), ShouldEqual, 1)
				So(queryResult.Series[0].Points[0][1].Float64, ShouldEqual, float64(tInitial.UnixNano()/1e6))
			})

			Convey("When doing a metric query using time (nullable) as time column should return metric with time in milliseconds", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT timeNullable as time, valueOne FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				So(len(queryResult.Series), ShouldEqual, 1)
				So(queryResult.Series[0].Points[0][1].Float64, ShouldEqual, float64(tInitial.UnixNano()/1e6))
			})

			Convey("When doing a metric query using epoch (int64) as time column and value column (int64) should return metric with time in milliseconds", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT timeInt64 as time, timeInt64 FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				So(len(queryResult.Series), ShouldEqual, 1)
				So(queryResult.Series[0].Points[0][1].Float64, ShouldEqual, float64(tInitial.UnixNano()/1e6))
			})

			Convey("When doing a metric query using epoch (int64 nullable) as time column and value column (int64 nullable) should return metric with time in milliseconds", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT timeInt64Nullable as time, timeInt64Nullable FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				So(len(queryResult.Series), ShouldEqual, 1)
				So(queryResult.Series[0].Points[0][1].Float64, ShouldEqual, float64(tInitial.UnixNano()/1e6))
			})

			Convey("When doing a metric query using epoch (float64) as time column and value column (float64) should return metric with time in milliseconds", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT timeFloat64 as time, timeFloat64 FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				So(len(queryResult.Series), ShouldEqual, 1)
				So(queryResult.Series[0].Points[0][1].Float64, ShouldEqual, float64(tInitial.UnixNano()/1e6))
			})

			Convey("When doing a metric query using epoch (float64 nullable) as time column and value column (float64 nullable) should return metric with time in milliseconds", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT timeFloat64Nullable as time, timeFloat64Nullable FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				So(len(queryResult.Series), ShouldEqual, 1)
				So(queryResult.Series[0].Points[0][1].Float64, ShouldEqual, float64(tInitial.UnixNano()/1e6))
			})

			Convey("When doing a metric query using epoch (int32) as time column and value column (int32) should return metric with time in milliseconds", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT timeInt32 as time, timeInt32 FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				So(len(queryResult.Series), ShouldEqual, 1)
				So(queryResult.Series[0].Points[0][1].Float64, ShouldEqual, float64(tInitial.UnixNano()/1e6))
			})

			Convey("When doing a metric query using epoch (int32 nullable) as time column and value column (int32 nullable) should return metric with time in milliseconds", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT timeInt32Nullable as time, timeInt32Nullable FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				So(len(queryResult.Series), ShouldEqual, 1)
				So(queryResult.Series[0].Points[0][1].Float64, ShouldEqual, float64(tInitial.UnixNano()/1e6))
			})

			Convey("When doing a metric query using epoch (float32) as time column and value column (float32) should return metric with time in milliseconds", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT timeFloat32 as time, timeFloat32 FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				So(len(queryResult.Series), ShouldEqual, 1)
				So(queryResult.Series[0].Points[0][1].Float64, ShouldEqual, float64(float32(tInitial.Unix()))*1e3)
			})

			Convey("When doing a metric query using epoch (float32 nullable) as time column and value column (float32 nullable) should return metric with time in milliseconds", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT timeFloat32Nullable as time, timeFloat32Nullable FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				So(len(queryResult.Series), ShouldEqual, 1)
				So(queryResult.Series[0].Points[0][1].Float64, ShouldEqual, float64(float32(tInitial.Unix()))*1e3)
			})

			Convey("When doing a metric query grouping by time and select metric column should return correct series", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT $__time(time), CONCAT(measurement, ' - value one') as metric, valueOne FROM metric_values ORDER BY 1,2`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				So(len(queryResult.Series), ShouldEqual, 2)
				So(queryResult.Series[0].Name, ShouldEqual, "Metric A - value one")
				So(queryResult.Series[1].Name, ShouldEqual, "Metric B - value one")
			})

			Convey("When doing a metric query with metric column and multiple value columns", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT $__time(time), measurement as metric, valueOne, valueTwo FROM metric_values ORDER BY 1,2`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				So(len(queryResult.Series), ShouldEqual, 4)
				So(queryResult.Series[0].Name, ShouldEqual, "Metric A valueOne")
				So(queryResult.Series[1].Name, ShouldEqual, "Metric A valueTwo")
				So(queryResult.Series[2].Name, ShouldEqual, "Metric B valueOne")
				So(queryResult.Series[3].Name, ShouldEqual, "Metric B valueTwo")
			})

			Convey("When doing a metric query grouping by time should return correct series", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT $__time(time), valueOne, valueTwo FROM metric_values ORDER BY 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)

				So(len(queryResult.Series), ShouldEqual, 2)
				So(queryResult.Series[0].Name, ShouldEqual, "valueOne")
				So(queryResult.Series[1].Name, ShouldEqual, "valueTwo")
			})
		})

		Convey("When doing a query with timeFrom,timeTo,unixEpochFrom,unixEpochTo macros", func() {
			tsdb.Interpolate = origInterpolate
			query := &tsdb.TsdbQuery{
				TimeRange: tsdb.NewFakeTimeRange("5m", "now", fromStart),
				Queries: []*tsdb.Query{
					{
						DataSource: &models.DataSource{JsonData: simplejson.New()},
						Model: simplejson.NewFromAny(map[string]interface{}{
							"rawSql": `SELECT time FROM metric_values WHERE time > $__timeFrom() OR time < $__timeTo() OR 1 < $__unixEpochFrom() OR $__unixEpochTo() > 1 ORDER BY 1`,
							"format": "time_series",
						}),
						RefId: "A",
					},
				},
			}

			resp, err := endpoint.Query(context.Background(), nil, query)
			So(err, ShouldBeNil)
			queryResult := resp.Results["A"]
			So(queryResult.Error, ShouldBeNil)
			So(queryResult.Meta.Get("sql").MustString(), ShouldEqual, "SELECT time FROM metric_values WHERE time > FROM_UNIXTIME(1521118500) OR time < FROM_UNIXTIME(1521118800) OR 1 < 1521118500 OR 1521118800 > 1 ORDER BY 1")

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
								"rawSql": `SELECT time_sec, description as text, tags FROM event WHERE $__unixEpochFilter(time_sec) AND tags='deploy' ORDER BY 1 ASC`,
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

				resp, err := endpoint.Query(context.Background(), nil, query)
				queryResult := resp.Results["Deploys"]
				So(err, ShouldBeNil)
				So(len(queryResult.Tables[0].Rows), ShouldEqual, 3)
			})

			Convey("When doing an annotation query of ticket events should return expected result", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT time_sec, description as text, tags FROM event WHERE $__unixEpochFilter(time_sec) AND tags='ticket' ORDER BY 1 ASC`,
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

				resp, err := endpoint.Query(context.Background(), nil, query)
				queryResult := resp.Results["Tickets"]
				So(err, ShouldBeNil)
				So(len(queryResult.Tables[0].Rows), ShouldEqual, 3)
			})

			Convey("When doing an annotation query with a time column in datetime format", func() {
				dt := time.Date(2018, 3, 14, 21, 20, 6, 0, time.UTC)
				dtFormat := "2006-01-02 15:04:05.999999999"

				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": fmt.Sprintf(`SELECT
									CAST('%s' as datetime) as time_sec,
									'message' as text,
									'tag1,tag2' as tags
								`, dt.Format(dtFormat)),
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
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
									 %d as time_sec,
									'message' as text,
									'tag1,tag2' as tags
								`, dt.Unix()),
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)
				So(len(queryResult.Tables[0].Rows), ShouldEqual, 1)
				columns := queryResult.Tables[0].Rows[0]

				//Should be in milliseconds
				So(columns[0].(int64), ShouldEqual, dt.Unix()*1000)
			})

			Convey("When doing an annotation query with a time column in epoch second format (signed integer) should return ms", func() {
				dt := time.Date(2018, 3, 14, 21, 20, 6, 0, time.Local)

				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": fmt.Sprintf(`SELECT
									 CAST('%d' as signed integer) as time_sec,
									'message' as text,
									'tag1,tag2' as tags
								`, dt.Unix()),
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)
				So(len(queryResult.Tables[0].Rows), ShouldEqual, 1)
				columns := queryResult.Tables[0].Rows[0]

				//Should be in milliseconds
				So(columns[0].(int64), ShouldEqual, dt.Unix()*1000)
			})

			Convey("When doing an annotation query with a time column in epoch millisecond format should return ms", func() {
				dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)

				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": fmt.Sprintf(`SELECT
									 %d as time_sec,
									'message' as text,
									'tag1,tag2' as tags
								`, dt.Unix()*1000),
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)
				So(len(queryResult.Tables[0].Rows), ShouldEqual, 1)
				columns := queryResult.Tables[0].Rows[0]

				//Should be in milliseconds
				So(columns[0].(int64), ShouldEqual, dt.Unix()*1000)
			})

			Convey("When doing an annotation query with a time column holding a unsigned integer null value should return nil", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT
									 cast(null as unsigned integer) as time_sec,
									'message' as text,
									'tag1,tag2' as tags
								`,
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				So(err, ShouldBeNil)
				queryResult := resp.Results["A"]
				So(queryResult.Error, ShouldBeNil)
				So(len(queryResult.Tables[0].Rows), ShouldEqual, 1)
				columns := queryResult.Tables[0].Rows[0]

				//Should be in milliseconds
				So(columns[0], ShouldBeNil)
			})

			Convey("When doing an annotation query with a time column holding a DATETIME null value should return nil", func() {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT
									 cast(null as DATETIME) as time_sec,
									'message' as text,
									'tag1,tag2' as tags
								`,
								"format": "table",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
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

func InitMySQLTestDB(t *testing.T) *xorm.Engine {
	x, err := xorm.NewEngine(sqlutil.TestDB_Mysql.DriverName, strings.Replace(sqlutil.TestDB_Mysql.ConnStr, "/grafana_tests", "/grafana_ds_tests", 1))
	if err != nil {
		t.Fatalf("Failed to init mysql db %v", err)
	}

	x.DatabaseTZ = time.UTC
	x.TZLocation = time.UTC

	// x.ShowSQL()

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
