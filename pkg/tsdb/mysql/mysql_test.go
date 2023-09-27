package mysql

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

// To run this test, set runMySqlTests=true
// Or from the commandline: GRAFANA_TEST_DB=mysql go test -v ./pkg/tsdb/mysql
// The tests require a MySQL db named grafana_ds_tests and a user/password grafana/password
// Use the docker/blocks/mysql_tests/docker-compose.yaml to spin up a
// preconfigured MySQL server suitable for running these tests.
// There is also a datasource and dashboard provisioned by devenv scripts that you can
// use to verify that the generated data are visualized as expected, see
// devenv/README.md for setup instructions.
func TestIntegrationMySQL(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	// change to true to run the MySQL tests
	runMySQLTests := false
	// runMySqlTests := true

	if !(db.IsTestDbMySQL() || runMySQLTests) {
		t.Skip()
	}

	x := InitMySQLTestDB(t)

	origXormEngine := sqleng.NewXormEngine
	origInterpolate := sqleng.Interpolate
	t.Cleanup(func() {
		sqleng.NewXormEngine = origXormEngine
		sqleng.Interpolate = origInterpolate
	})

	sqleng.NewXormEngine = func(d, c string) (*xorm.Engine, error) {
		return x, nil
	}

	sqleng.Interpolate = func(query backend.DataQuery, timeRange backend.TimeRange, timeInterval string, sql string) (string, error) {
		return sql, nil
	}

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			MaxOpenConns:    0,
			MaxIdleConns:    2,
			ConnMaxLifetime: 14400,
		},
	}

	config := sqleng.DataPluginConfiguration{
		DriverName:        "mysql",
		ConnectionString:  "",
		DSInfo:            dsInfo,
		TimeColumnNames:   []string{"time", "time_sec"},
		MetricColumnTypes: []string{"CHAR", "VARCHAR", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT"},
		RowLimit:          1000000,
	}

	rowTransformer := mysqlQueryResultTransformer{}

	exe, err := sqleng.NewQueryDataHandler(setting.NewCfg(), config, &rowTransformer, newMysqlMacroEngine(logger, setting.NewCfg()), logger)

	require.NoError(t, err)

	sess := x.NewSession()
	t.Cleanup(sess.Close)
	fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)

	t.Run("Given a table with different native data types", func(t *testing.T) {
		exists, err := sess.IsTableExist("mysql_types")
		require.NoError(t, err)
		if exists {
			err := sess.DropTable("mysql_types")
			require.NoError(t, err)
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
		_, err = sess.Exec(sql)
		require.NoError(t, err)

		sql = "INSERT INTO `mysql_types` "
		sql += "(`atinyint`, `avarchar`, `achar`, `amediumint`, `asmallint`, `abigint`, `aint`, `adouble`, "
		sql += "`anewdecimal`, `afloat`, `atimestamp`, `adatetime`,  `atime`, `ayear`, `abit`, `atinytext`, "
		sql += "`atinyblob`, `atext`, `ablob`, `amediumtext`, `amediumblob`, `alongtext`, `alongblob`, "
		sql += "`aenum`, `aset`, `adate`, `time_sec`) "
		sql += "VALUES(1, 'abc', 'def', 1, 10, 100, 1420070400, 1.11, "
		sql += "2.22, 3.33, current_timestamp(), now(), '11:11:11', '2018', 1, 'tinytext', "
		sql += "'tinyblob', 'text', 'blob', 'mediumtext', 'mediumblob', 'longtext', 'longblob', "
		sql += "'val2', 'a,b', curdate(), '2018-01-01 00:01:01.123456');"
		_, err = sess.Exec(sql)
		require.NoError(t, err)

		t.Run("Query with Table format should map MySQL column types to Go types", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT * FROM mysql_types",
							"format": "table"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)
			frames := queryResult.Frames
			require.NoError(t, err)

			require.Len(t, frames, 1)
			frameOne := frames[0]
			require.Len(t, frames[0].Fields, 31)
			require.Equal(t, int64(1), *(frameOne.Fields[0].At(0).(*int64)))
			require.Equal(t, "abc", *frameOne.Fields[1].At(0).(*string))
			require.Equal(t, "def", *frameOne.Fields[2].At(0).(*string))
			require.Equal(t, int32(1), frameOne.Fields[3].At(0).(int32))
			require.Equal(t, int64(10), *(frameOne.Fields[4].At(0).(*int64)))
			require.Equal(t, int64(100), *(frameOne.Fields[5].At(0).(*int64)))
			require.Equal(t, int64(1420070400), *(frameOne.Fields[6].At(0).(*int64)))
			require.Equal(t, 1.11, *frameOne.Fields[7].At(0).(*float64))
			require.Equal(t, 2.22, *frameOne.Fields[8].At(0).(*float64))
			require.Equal(t, float64(3.33), *(frameOne.Fields[9].At(0).(*float64)))
			require.WithinDuration(t, time.Now().UTC(), *frameOne.Fields[10].At(0).(*time.Time), 10*time.Second)
			require.WithinDuration(t, time.Now(), *frameOne.Fields[11].At(0).(*time.Time), 10*time.Second)
			require.Equal(t, "11:11:11", *frameOne.Fields[12].At(0).(*string))
			require.Equal(t, int64(2018), *frameOne.Fields[13].At(0).(*int64))
			require.Equal(t, string([]byte{1}), *frameOne.Fields[14].At(0).(*string))
			require.Equal(t, "tinytext", *frameOne.Fields[15].At(0).(*string))
			require.Equal(t, "tinyblob", *frameOne.Fields[16].At(0).(*string))
			require.Equal(t, "text", *frameOne.Fields[17].At(0).(*string))
			require.Equal(t, "blob", *frameOne.Fields[18].At(0).(*string))
			require.Equal(t, "mediumtext", *frameOne.Fields[19].At(0).(*string))
			require.Equal(t, "mediumblob", *frameOne.Fields[20].At(0).(*string))
			require.Equal(t, "longtext", *frameOne.Fields[21].At(0).(*string))
			require.Equal(t, "longblob", *frameOne.Fields[22].At(0).(*string))
			require.Equal(t, "val2", *frameOne.Fields[23].At(0).(*string))
			require.Equal(t, "a,b", *frameOne.Fields[24].At(0).(*string))
			require.Equal(t, time.Now().UTC().Format("2006-01-02T00:00:00Z"), (*frameOne.Fields[25].At(0).(*time.Time)).Format("2006-01-02T00:00:00Z"))
			require.Equal(t, int64(1514764861123456000), frameOne.Fields[26].At(0).(*time.Time).UnixNano())
			require.Nil(t, frameOne.Fields[27].At(0))
			require.Nil(t, frameOne.Fields[28].At(0))
			require.Nil(t, frameOne.Fields[29].At(0))
			require.Nil(t, frameOne.Fields[30].At(0))
		})
	})

	t.Run("Given a table with metrics that lacks data for some series ", func(t *testing.T) {
		type metric struct {
			Time  time.Time
			Value int64
		}

		exists, err := sess.IsTableExist(metric{})
		require.NoError(t, err)
		if exists {
			err := sess.DropTable(metric{})
			require.NoError(t, err)
		}
		err = sess.CreateTable(metric{})
		require.NoError(t, err)

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
		require.NoError(t, err)

		t.Run("When doing a metric query using timeGroup", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeGroup(time, '5m') as time_sec, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			// without fill this should result in 4 buckets
			require.Equal(t, 4, frames[0].Fields[0].Len())

			dt := fromStart

			for i := 0; i < 2; i++ {
				aValue := *frames[0].Fields[1].At(i).(*float64)
				aTime := *frames[0].Fields[0].At(i).(*time.Time)
				require.Equal(t, float64(15), aValue)
				require.Equal(t, dt.Unix(), aTime.Unix())
				dt = dt.Add(5 * time.Minute)
			}

			// adjust for 10 minute gap between first and second set of points
			dt = dt.Add(10 * time.Minute)
			for i := 2; i < 4; i++ {
				aValue := *frames[0].Fields[1].At(i).(*float64)
				aTime := *frames[0].Fields[0].At(i).(*time.Time)
				require.Equal(t, float64(20), aValue)
				require.Equal(t, dt.Unix(), aTime.Unix())
				dt = dt.Add(5 * time.Minute)
			}
		})

		t.Run("When doing a metric query using timeGroup with NULL fill enabled", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeGroup(time, '5m', NULL) as time_sec, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
							"format": "time_series"
						}`),
						RefID: "A",
						TimeRange: backend.TimeRange{
							From: fromStart,
							To:   fromStart.Add(34 * time.Minute),
						},
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, 7, frames[0].Fields[0].Len())

			dt := fromStart

			for i := 0; i < 2; i++ {
				aValue := *frames[0].Fields[1].At(i).(*float64)
				aTime := *frames[0].Fields[0].At(i).(*time.Time)
				require.Equal(t, float64(15), aValue)
				require.Equal(t, dt.Unix(), aTime.Unix())
				dt = dt.Add(5 * time.Minute)
			}

			// check for NULL values inserted by fill
			require.Nil(t, frames[0].Fields[1].At(2).(*float64))
			require.Nil(t, frames[0].Fields[1].At(3).(*float64))

			// adjust for 10 minute gap between first and second set of points
			dt = dt.Add(10 * time.Minute)
			for i := 4; i < 6; i++ {
				aValue := *frames[0].Fields[1].At(i).(*float64)
				aTime := *frames[0].Fields[0].At(i).(*time.Time)
				require.Equal(t, float64(20), aValue)
				require.Equal(t, dt.Unix(), aTime.Unix())
				dt = dt.Add(5 * time.Minute)
			}

			// check for NULL values inserted by fill
			require.Nil(t, frames[0].Fields[1].At(6).(*float64))
		})

		t.Run("When doing a metric query using timeGroup and $__interval", func(t *testing.T) {
			mockInterpolate := sqleng.Interpolate
			sqleng.Interpolate = origInterpolate
			t.Cleanup(func() {
				sqleng.Interpolate = mockInterpolate
			})

			t.Run("Should replace $__interval", func(t *testing.T) {
				query := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							JSON: []byte(`{
								"rawSql": "SELECT $__timeGroup(time, $__interval) AS time, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
								"format": "time_series"
							}`),
							RefID: "A",
							TimeRange: backend.TimeRange{
								From: fromStart,
								To:   fromStart.Add(30 * time.Minute),
							},
						},
					},
				}

				resp, err := exe.QueryData(context.Background(), query)
				require.NoError(t, err)
				queryResult := resp.Responses["A"]
				require.NoError(t, queryResult.Error)
				frames := queryResult.Frames
				require.Len(t, frames, 1)
				require.Equal(t, "SELECT UNIX_TIMESTAMP(time) DIV 60 * 60 AS time, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1", frames[0].Meta.ExecutedQueryString)
			})
		})

		t.Run("When doing a metric query using timeGroup with value fill enabled", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeGroup(time, '5m', 1.5) as time_sec, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
							"format": "time_series"
						}`),
						RefID: "A",
						TimeRange: backend.TimeRange{
							From: fromStart,
							To:   fromStart.Add(34 * time.Minute),
						},
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.Equal(t, data.TimeSeriesTimeFieldName, frames[0].Fields[0].Name)
			require.Equal(t, 7, frames[0].Fields[0].Len())
			require.Equal(t, 1.5, *frames[0].Fields[1].At(3).(*float64))
		})

		t.Run("When doing a metric query using timeGroup with previous fill enabled", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeGroup(time, '5m', previous) as time_sec, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
							"format": "time_series"
						}`),
						RefID: "A",
						TimeRange: backend.TimeRange{
							From: fromStart,
							To:   fromStart.Add(34 * time.Minute),
						},
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.Equal(t, float64(15.0), *frames[0].Fields[1].At(2).(*float64))
			require.Equal(t, float64(15.0), *frames[0].Fields[1].At(3).(*float64))
			require.Equal(t, float64(20.0), *frames[0].Fields[1].At(6).(*float64))
		})
	})

	t.Run("Given a table with metrics having multiple values and measurements", func(t *testing.T) {
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
			ValueThree          int64 `xorm:"tinyint(1) null 'valueThree'"`
			ValueFour           int64 `xorm:"smallint(1) null 'valueFour'"`
		}

		exists, err := sess.IsTableExist(metric_values{})
		require.NoError(t, err)
		if exists {
			err := sess.DropTable(metric_values{})
			require.NoError(t, err)
		}
		err = sess.CreateTable(metric_values{})
		require.NoError(t, err)

		rng := rand.New(rand.NewSource(time.Now().Unix()))
		rnd := func(min, max int64) int64 {
			return rng.Int63n(max-min) + min
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
				ValueThree:          int64(6),
				ValueFour:           int64(8),
			}
			second := first
			second.Measurement = "Metric B"
			second.ValueOne = rnd(0, 100)
			second.ValueTwo = rnd(0, 100)
			second.ValueThree = int64(6)
			second.ValueFour = int64(8)

			series = append(series, &first)
			series = append(series, &second)
		}

		_, err = sess.InsertMulti(series)
		require.NoError(t, err)

		t.Run("When doing a metric query using time as time column should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT time, valueOne FROM metric_values ORDER BY time LIMIT 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.NoError(t, err)
			require.Len(t, frames, 1)
			require.Equal(t, data.TimeSeriesTimeFieldName, frames[0].Fields[0].Name)
			require.True(t, tInitial.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
		})

		t.Run("When doing a metric query using tinyint as value column should return metric with value in *float64", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT time, valueThree FROM metric_values ORDER BY time LIMIT 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.NoError(t, err)
			require.Len(t, frames, 1)
			require.Equal(t, float64(6), *frames[0].Fields[1].At(0).(*float64))
		})

		t.Run("When doing a metric query using smallint as value column should return metric with value in *float64", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT time, valueFour FROM metric_values ORDER BY time LIMIT 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.NoError(t, err)
			require.Len(t, frames, 1)
			require.Equal(t, float64(8), *frames[0].Fields[1].At(0).(*float64))
		})

		t.Run("When doing a metric query using time (nullable) as time column should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT timeNullable as time, valueOne FROM metric_values ORDER BY time LIMIT 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.True(t, tInitial.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
		})

		t.Run("When doing a metric query using epoch (int64) as time column and value column (int64) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT timeInt64 as time, timeInt64 FROM metric_values ORDER BY time LIMIT 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.True(t, tInitial.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
		})

		t.Run("When doing a metric query using epoch (int64 nullable) as time column and value column (int64 nullable) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT timeInt64Nullable as time, timeInt64Nullable FROM metric_values ORDER BY time LIMIT 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.True(t, tInitial.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
		})

		t.Run("When doing a metric query using epoch (float64) as time column and value column (float64) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT timeFloat64 as time, timeFloat64 FROM metric_values ORDER BY time LIMIT 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.True(t, tInitial.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
		})

		t.Run("When doing a metric query using epoch (float64 nullable) as time column and value column (float64 nullable) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT timeFloat64Nullable as time, timeFloat64Nullable FROM metric_values ORDER BY time LIMIT 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.True(t, tInitial.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
		})

		t.Run("When doing a metric query using epoch (int32) as time column and value column (int32) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT timeInt32 as time, timeInt32 FROM metric_values ORDER BY time LIMIT 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.True(t, tInitial.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
		})

		t.Run("When doing a metric query using epoch (int32 nullable) as time column and value column (int32 nullable) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT timeInt32Nullable as time, timeInt32Nullable FROM metric_values ORDER BY time LIMIT 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.True(t, tInitial.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
		})

		t.Run("When doing a metric query using epoch (float32) as time column and value column (float32) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT timeFloat32 as time, timeFloat32 FROM metric_values ORDER BY time LIMIT 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			aTime := time.Unix(0, int64(float64(float32(tInitial.Unix()))*1e3)*int64(time.Millisecond))
			require.True(t, aTime.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
		})

		t.Run("When doing a metric query using epoch (float32 nullable) as time column and value column (float32 nullable) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT timeFloat32Nullable as time, timeFloat32Nullable FROM metric_values ORDER BY time LIMIT 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			aTime := time.Unix(0, int64(float64(float32(tInitial.Unix()))*1e3)*int64(time.Millisecond))
			require.True(t, aTime.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
		})

		t.Run("When doing a metric query grouping by time and select metric column should return correct series", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__time(time), CONCAT(measurement, ' - value one') as metric, valueOne FROM metric_values ORDER BY 1,2",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.Len(t, frames[0].Fields, 3)
			require.Equal(t, "Metric A - value one", frames[0].Fields[1].Name)
			require.Equal(t, "Metric B - value one", frames[0].Fields[2].Name)
		})

		t.Run("When doing a metric query with metric column and multiple value columns", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__time(time), measurement as metric, valueOne, valueTwo FROM metric_values ORDER BY 1,2",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.NoError(t, err)
			require.Len(t, frames, 1)
			require.Len(t, frames[0].Fields, 5)
			require.Equal(t, "valueOne", frames[0].Fields[1].Name)
			require.Equal(t, data.Labels{"metric": "Metric A"}, frames[0].Fields[1].Labels)
			require.Equal(t, "valueOne", frames[0].Fields[2].Name)
			require.Equal(t, data.Labels{"metric": "Metric B"}, frames[0].Fields[2].Labels)
			require.Equal(t, "valueTwo", frames[0].Fields[3].Name)
			require.Equal(t, data.Labels{"metric": "Metric A"}, frames[0].Fields[3].Labels)
			require.Equal(t, "valueTwo", frames[0].Fields[4].Name)
			require.Equal(t, data.Labels{"metric": "Metric B"}, frames[0].Fields[4].Labels)
		})

		t.Run("When doing a metric query grouping by time should return correct series", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__time(time), valueOne, valueTwo FROM metric_values ORDER BY 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.Len(t, frames[0].Fields, 3)
			require.Equal(t, "valueOne", frames[0].Fields[1].Name)
			require.Equal(t, "valueTwo", frames[0].Fields[2].Name)
		})
	})

	t.Run("When doing a query with timeFrom,timeTo,unixEpochFrom,unixEpochTo macros", func(t *testing.T) {
		sqleng.Interpolate = origInterpolate
		query := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					JSON: []byte(`{
						"rawSql": "SELECT time FROM metric_values WHERE time > $__timeFrom() OR time < $__timeTo() OR 1 < $__unixEpochFrom() OR $__unixEpochTo() > 1 ORDER BY 1",
						"format": "time_series"
					}`),
					RefID:     "A",
					TimeRange: backend.TimeRange{From: fromStart.Add(-5 * time.Minute), To: fromStart},
				},
			},
		}

		resp, err := exe.QueryData(context.Background(), query)
		require.NoError(t, err)
		queryResult := resp.Responses["A"]
		require.NoError(t, queryResult.Error)
		frames := queryResult.Frames
		require.Len(t, frames, 1)
		require.Equal(t, "SELECT time FROM metric_values WHERE time > FROM_UNIXTIME(1521118500) OR time < FROM_UNIXTIME(1521118800) OR 1 < 1521118500 OR 1521118800 > 1 ORDER BY 1", frames[0].Meta.ExecutedQueryString)
	})

	t.Run("Given a table with event data", func(t *testing.T) {
		type event struct {
			TimeSec     int64
			Description string
			Tags        string
		}

		exists, err := sess.IsTableExist(event{})
		require.NoError(t, err)
		if exists {
			err := sess.DropTable(event{})
			require.NoError(t, err)
		}
		err = sess.CreateTable(event{})
		require.NoError(t, err)

		events := []*event{}
		for _, t := range genTimeRangeByInterval(fromStart.Add(-20*time.Minute), time.Hour, 25*time.Minute) {
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
			_, err := sess.Insert(e)
			require.NoError(t, err)
		}

		t.Run("When doing an annotation query of deploy events should return expected result", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT time_sec, description as text, tags FROM event WHERE $__unixEpochFilter(time_sec) AND tags='deploy' ORDER BY 1 ASC",
							"format": "table"
						}`),
						RefID: "Deploys",
						TimeRange: backend.TimeRange{
							From: fromStart.Add(-20 * time.Minute),
							To:   fromStart.Add(40 * time.Minute),
						},
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["Deploys"]

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.Len(t, frames[0].Fields, 3)
			require.Equal(t, 3, frames[0].Fields[0].Len())
		})

		t.Run("When doing an annotation query of ticket events should return expected result", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT time_sec, description as text, tags FROM event WHERE $__unixEpochFilter(time_sec) AND tags='ticket' ORDER BY 1 ASC",
							"format": "table"
						}`),
						RefID: "Tickets",
						TimeRange: backend.TimeRange{
							From: fromStart.Add(-20 * time.Minute),
							To:   fromStart.Add(40 * time.Minute),
						},
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["Tickets"]
			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.Len(t, frames[0].Fields, 3)
			require.Equal(t, 3, frames[0].Fields[0].Len())
		})

		t.Run("When doing an annotation query with a time column in datetime format", func(t *testing.T) {
			dt := time.Date(2018, 3, 14, 21, 20, 6, 0, time.UTC)
			dtFormat := "2006-01-02 15:04:05.999999999"
			queryJson := fmt.Sprintf("{\"rawSql\": \"SELECT CAST('%s' as datetime) as time_sec, 'message' as text, 'tag1,tag2' as tags\", \"format\": \"table\"}", dt.Format(dtFormat))
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON:  []byte(queryJson),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.Equal(t, 1, frames[0].Fields[0].Len())
			//Should be in time.Time
			require.Equal(t, dt.Unix(), (*frames[0].Fields[0].At(0).(*time.Time)).Unix())
		})

		t.Run("When doing an annotation query with a time column in epoch second format should return ms", func(t *testing.T) {
			dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)
			queryJson := fmt.Sprintf("{\"rawSql\": \"SELECT %d as time_sec, 'message' as text, 'tag1,tag2' as tags\", \"format\": \"table\"}", dt.Unix())
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON:  []byte(queryJson),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.Equal(t, 1, frames[0].Fields[0].Len())
			//Should be in time.Time
			require.Equal(t, dt.Unix(), (*frames[0].Fields[0].At(0).(*time.Time)).Unix())
		})

		t.Run("When doing an annotation query with a time column in epoch second format (signed integer) should return ms", func(t *testing.T) {
			dt := time.Date(2018, 3, 14, 21, 20, 6, 0, time.Local)
			queryJson := fmt.Sprintf("{\"rawSql\": \"SELECT CAST('%d' as signed integer) as time_sec, 'message' as text, 'tag1,tag2' as tags\", \"format\": \"table\"}", dt.Unix())
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON:  []byte(queryJson),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.Equal(t, 1, frames[0].Fields[0].Len())
			//Should be in time.Time
			require.Equal(t, dt.Unix(), (*frames[0].Fields[0].At(0).(*time.Time)).Unix())
		})

		t.Run("When doing an annotation query with a time column in epoch millisecond format should return ms", func(t *testing.T) {
			dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)
			queryJson := fmt.Sprintf("{\"rawSql\": \"SELECT %d as time_sec, 'message' as text, 'tag1,tag2' as tags\", \"format\": \"table\"}", dt.Unix()*1000)

			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON:  []byte(queryJson),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.Equal(t, 1, frames[0].Fields[0].Len())
			//Should be in time.Time
			require.Equal(t, dt.Unix(), (*frames[0].Fields[0].At(0).(*time.Time)).Unix())
		})

		t.Run("When doing an annotation query with a time column holding a unsigned integer null value should return nil", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT cast(null as unsigned integer) as time_sec, 'message' as text, 'tag1,tag2' as tags",
							"format": "table"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.Equal(t, 1, frames[0].Fields[0].Len())

			//Should be in time.Time
			require.Nil(t, frames[0].Fields[0].At(0))
		})

		t.Run("When doing an annotation query with a time column holding a DATETIME null value should return nil", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT cast(null as DATETIME) as time_sec, 'message' as text, 'tag1,tag2' as tags",
							"format": "table"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.Equal(t, 1, frames[0].Fields[0].Len())

			//Should be in time.Time
			require.Nil(t, frames[0].Fields[0].At(0))
		})

		t.Run("When doing an annotation query with a time and timeend column should return two fields of type time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT 1631053772276 as time, 1631054012276 as timeend, '' as text, '' as tags",
							"format": "table"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, 4, len(frames[0].Fields))

			require.Equal(t, data.FieldTypeNullableTime, frames[0].Fields[0].Type())
			require.Equal(t, data.FieldTypeNullableTime, frames[0].Fields[1].Type())
		})

		t.Run("When row limit set to 1", func(t *testing.T) {
			dsInfo := sqleng.DataSourceInfo{}
			config := sqleng.DataPluginConfiguration{
				DriverName:        "mysql",
				ConnectionString:  "",
				DSInfo:            dsInfo,
				TimeColumnNames:   []string{"time", "time_sec"},
				MetricColumnTypes: []string{"CHAR", "VARCHAR", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT"},
				RowLimit:          1,
			}

			queryResultTransformer := mysqlQueryResultTransformer{}

			handler, err := sqleng.NewQueryDataHandler(setting.NewCfg(), config, &queryResultTransformer, newMysqlMacroEngine(logger, setting.NewCfg()), logger)
			require.NoError(t, err)

			t.Run("When doing a table query that returns 2 rows should limit the result to 1 row", func(t *testing.T) {
				query := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							JSON: []byte(`{
							"rawSql": "SELECT 1 as value UNION ALL select 2 as value",
							"format": "table"
						}`),
							RefID: "A",
							TimeRange: backend.TimeRange{
								From: time.Now(),
								To:   time.Now(),
							},
						},
					},
				}

				resp, err := handler.QueryData(context.Background(), query)
				require.NoError(t, err)
				queryResult := resp.Responses["A"]
				require.NoError(t, queryResult.Error)
				frames := queryResult.Frames
				require.NoError(t, err)
				require.Equal(t, 1, len(frames))
				require.Equal(t, 1, len(frames[0].Fields))
				require.Equal(t, 1, frames[0].Rows())
				require.Len(t, frames[0].Meta.Notices, 1)
				require.Equal(t, data.NoticeSeverityWarning, frames[0].Meta.Notices[0].Severity)
			})

			t.Run("When doing a time series that returns 2 rows should limit the result to 1 row", func(t *testing.T) {
				query := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							JSON: []byte(`{
							"rawSql": "SELECT 1 as time, 1 as value UNION ALL select 2 as time, 2 as value",
							"format": "time_series"
						}`),
							RefID: "A",
							TimeRange: backend.TimeRange{
								From: time.Now(),
								To:   time.Now(),
							},
						},
					},
				}

				resp, err := handler.QueryData(context.Background(), query)
				require.NoError(t, err)
				queryResult := resp.Responses["A"]
				require.NoError(t, queryResult.Error)
				frames := queryResult.Frames
				require.NoError(t, err)
				require.Equal(t, 1, len(frames))
				require.Equal(t, 2, len(frames[0].Fields))
				require.Equal(t, 1, frames[0].Rows())
				require.Len(t, frames[0].Meta.Notices, 1)
				require.Equal(t, data.NoticeSeverityWarning, frames[0].Meta.Notices[0].Severity)
			})
		})
	})

	t.Run("Given an empty table", func(t *testing.T) {
		type emptyObj struct {
			EmptyKey string
			EmptyVal int64
		}

		exists, err := sess.IsTableExist(emptyObj{})
		require.NoError(t, err)
		if exists {
			err := sess.DropTable(emptyObj{})
			require.NoError(t, err)
		}
		err = sess.CreateTable(emptyObj{})
		require.NoError(t, err)

		t.Run("When no rows are returned, should return an empty frame", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT * FROM empty_obj",
							"format": "table"
						}`),
						RefID: "A",
						TimeRange: backend.TimeRange{
							From: time.Now(),
							To:   time.Now().Add(1 * time.Minute),
						},
					},
				},
			}

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			require.Equal(t, 0, frames[0].Rows())
			require.NotNil(t, frames[0].Fields)
			require.Empty(t, frames[0].Fields)
		})
	})
}

func InitMySQLTestDB(t *testing.T) *xorm.Engine {
	testDB := sqlutil.MySQLTestDB()
	x, err := xorm.NewEngine(testDB.DriverName, strings.Replace(testDB.ConnStr, "/grafana_tests",
		"/grafana_ds_tests", 1)+"&parseTime=true&loc=UTC")
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
