package mssql

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/tsdb/mssql/kerberos"
	"github.com/grafana/grafana/pkg/tsdb/mssql/sqleng"
)

// To run this test, set runMssqlTests=true
// Or from the commandline: GRAFANA_TEST_DB=mssql go test -v ./pkg/tsdb/mssql
// The tests require a MSSQL db named grafanatest and a user/password grafana/Password!
// Use the docker/blocks/mssql_tests/docker-compose.yaml to spin up a
// preconfigured MSSQL server suitable for running these tests.
// There is also a datasource and dashboard provisioned by devenv scripts that you can
// use to verify that the generated data are visualized as expected, see
// devenv/README.md for setup instructions.
// If needed, change the variable below to the IP address of the database.
var serverIP = "localhost"

func TestMSSQL(t *testing.T) {
	// change to true to run the MSSQL tests
	const runMssqlTests = false

	if !db.IsTestDBMSSQL() && !runMssqlTests {
		t.Skip()
	}

	queryResultTransformer := mssqlQueryResultTransformer{}
	dsInfo := sqleng.DataSourceInfo{}
	config := sqleng.DataPluginConfiguration{
		DSInfo:            dsInfo,
		MetricColumnTypes: []string{"VARCHAR", "CHAR", "NVARCHAR", "NCHAR"},
		RowLimit:          1000000,
	}

	logger := backend.NewLoggerWith("logger", "mssql.test")

	db := initMSSQLTestDB(t, config.DSInfo.JsonData)

	endpoint, err := sqleng.NewQueryDataHandler("", db, config, &queryResultTransformer, newMssqlMacroEngine(), logger)
	require.NoError(t, err)

	fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)

	t.Run("Given a table with different native data types", func(t *testing.T) {
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
						c_datetimeoffset datetimeoffset,

						c_uuid uniqueidentifier
						c_sql_variant sql_variant
					)
				`

		_, err := db.Exec(sql)
		require.NoError(t, err)

		dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)
		const dtFormat = "2006-01-02 15:04:05.999999999"
		d := dt.Format(dtFormat)
		dt2 := time.Date(2018, 3, 14, 21, 20, 6, 8896406e2, time.UTC)
		const dt2Format = "2006-01-02 15:04:05.999999999 -07:00"
		d2 := dt2.Format(dt2Format)
		uuid := "B33D42A3-AC5A-4D4C-81DD-72F3D5C49025"

		sql = fmt.Sprintf(`
				INSERT INTO [mssql_types]
				SELECT
		    1, 5, 20020, 980300, 1420070400, '$20000.15', '£2.15', 12345.12,
		    1.11, 2.22, 3.33,
					'char10', 'varchar10', 'text',
					N'☺nchar12☺', N'☺nvarchar12☺', N'☺text☺',
					CAST('%s' AS DATETIME), CAST('%s' AS DATETIME2), CAST('%s' AS SMALLDATETIME), CAST('%s' AS DATE), CAST('%s' AS TIME), SWITCHOFFSET(CAST('%s' AS DATETIMEOFFSET), '-07:00'),
					CONVERT(uniqueidentifier, '%s'), 'test-sql-variant'
		`, d, d2, d, d, d, d2, uuid)

		_, err = db.Exec(sql)
		require.NoError(t, err)

		t.Run("When doing a table query should map MSSQL column types to Go types", func(t *testing.T) {
			query := backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON:  []byte(`{"rawSql": "SELECT * FROM mssql_types", "format": "table"}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), &query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NotNil(t, queryResult)
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.NoError(t, err)
			require.Equal(t, 1, len(frames))
			require.Equal(t, 24, len(frames[0].Fields))

			require.Equal(t, true, *frames[0].Fields[0].At(0).(*bool))
			require.Equal(t, int64(5), *frames[0].Fields[1].At(0).(*int64))
			require.Equal(t, int64(20020), *frames[0].Fields[2].At(0).(*int64))
			require.Equal(t, int64(980300), *frames[0].Fields[3].At(0).(*int64))
			require.Equal(t, int64(1420070400), *frames[0].Fields[4].At(0).(*int64))

			require.Equal(t, float64(20000.15), *frames[0].Fields[5].At(0).(*float64))
			require.Equal(t, float64(2.15), *frames[0].Fields[6].At(0).(*float64))
			require.Equal(t, float64(12345.12), *frames[0].Fields[7].At(0).(*float64))
			require.Equal(t, float64(1.1100000143051147), *frames[0].Fields[8].At(0).(*float64))
			require.Equal(t, float64(2.22), *frames[0].Fields[9].At(0).(*float64))
			require.Equal(t, float64(3.33), *frames[0].Fields[10].At(0).(*float64))

			require.Equal(t, "char10    ", *frames[0].Fields[11].At(0).(*string))
			require.Equal(t, "varchar10", *frames[0].Fields[12].At(0).(*string))
			require.Equal(t, "text", *frames[0].Fields[13].At(0).(*string))

			require.Equal(t, "☺nchar12☺   ", *frames[0].Fields[14].At(0).(*string))
			require.Equal(t, "☺nvarchar12☺", *frames[0].Fields[15].At(0).(*string))
			require.Equal(t, "☺text☺", *frames[0].Fields[16].At(0).(*string))

			require.Equal(t, dt.Unix(), (*frames[0].Fields[17].At(0).(*time.Time)).Unix())
			require.Equal(t, dt2, *frames[0].Fields[18].At(0).(*time.Time))
			require.Equal(t, dt.Truncate(time.Minute), *frames[0].Fields[19].At(0).(*time.Time))
			require.Equal(t, dt.Truncate(24*time.Hour), *frames[0].Fields[20].At(0).(*time.Time))
			require.Equal(t, time.Date(1, 1, 1, dt.Hour(), dt.Minute(), dt.Second(), dt.Nanosecond(), time.UTC), *frames[0].Fields[21].At(0).(*time.Time))
			require.Equal(t, dt2.In(time.FixedZone("UTC-7", int(-7*60*60))).Unix(), (*frames[0].Fields[22].At(0).(*time.Time)).Unix())

			require.Equal(t, uuid, *frames[0].Fields[23].At(0).(*string))
			require.Equal(t, "test-sql-variant", *frames[0].Fields[24].At(0).(*string))
		})
	})

	t.Run("Given a table with metrics that lacks data for some series ", func(t *testing.T) {
		sql := `
							IF OBJECT_ID('dbo.[metric]', 'U') IS NOT NULL
								DROP TABLE dbo.[metric]

							CREATE TABLE [metric] (
								time datetime,
								value int
							)
						`

		_, err := db.Exec(sql)
		require.NoError(t, err)

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

		for _, m := range series {
			_, err := db.Exec(`INSERT INTO metric ("time", value) VALUES (?, ?)`, m.Time.UTC(), m.Value)
			require.NoError(t, err)
		}

		t.Run("When doing a metric query using timeGroup", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeGroup(time, '5m') AS time, avg(value) as value FROM metric GROUP BY $__timeGroup(time, '5m') ORDER BY 1",
							"format": "time_series"}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
			// without fill this should result in 4 buckets
			require.Equal(t, 4, frames[0].Fields[0].Len())

			dt := fromStart

			for i := 0; i < 2; i++ {
				aValue := *frames[0].Fields[1].At(i).(*float64)
				aTime := *frames[0].Fields[0].At(i).(*time.Time)
				require.Equal(t, float64(15), aValue)
				require.Equal(t, dt, aTime)
				dt = dt.Add(5 * time.Minute)
			}

			// adjust for 10 minute gap between first and second set of points
			dt = dt.Add(10 * time.Minute)
			for i := 2; i < 4; i++ {
				aValue := *frames[0].Fields[1].At(i).(*float64)
				aTime := *frames[0].Fields[0].At(i).(*time.Time)
				require.Equal(t, float64(20), aValue)
				require.Equal(t, dt, aTime)
				dt = dt.Add(5 * time.Minute)
			}
		})

		t.Run("When doing a metric query using timeGroup with NULL fill enabled", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeGroup(time, '5m', NULL) AS time, avg(value) as value FROM metric GROUP BY $__timeGroup(time, '5m') ORDER BY 1",
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

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Len(t, frames, 1)
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

			require.Nil(t, frames[0].Fields[1].At(6).(*float64))
		})

		t.Run("When doing a metric query using timeGroup and $__interval", func(t *testing.T) {
			t.Run("Should replace $__interval", func(t *testing.T) {
				query := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							JSON: []byte(`{
								"rawSql": "SELECT $__timeGroup(time, $__interval) AS time, avg(value) as value FROM metric GROUP BY $__timeGroup(time, $__interval) ORDER BY 1",
								"format": "time_series"}`),
							RefID:    "A",
							Interval: time.Second * 60,
							TimeRange: backend.TimeRange{
								From: fromStart,
								To:   fromStart.Add(30 * time.Minute),
							},
						},
					},
				}

				resp, err := endpoint.QueryData(context.Background(), query)
				require.NoError(t, err)
				queryResult := resp.Responses["A"]
				require.NoError(t, queryResult.Error)

				frames := queryResult.Frames
				require.Len(t, frames, 1)
				require.Equal(t, "SELECT FLOOR(DATEDIFF(second, '1970-01-01', time)/60)*60 AS time, avg(value) as value FROM metric GROUP BY FLOOR(DATEDIFF(second, '1970-01-01', time)/60)*60 ORDER BY 1", frames[0].Meta.ExecutedQueryString)
			})
		})
		t.Run("When doing a metric query using timeGroup with float fill enabled", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeGroup(time, '5m', 1.5) AS time, avg(value) as value FROM metric GROUP BY $__timeGroup(time, '5m') ORDER BY 1",
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

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, 7, frames[0].Fields[0].Len())
			require.Equal(t, 1.5, *frames[0].Fields[1].At(3).(*float64))
		})
	})

	t.Run("Given a table with metrics having multiple values and measurements", func(t *testing.T) {
		type metric_values struct {
			Time                time.Time
			TimeInt64           int64
			TimeInt64Nullable   *int64
			TimeFloat64         float64
			TimeFloat64Nullable *float64
			TimeInt32           int32
			TimeInt32Nullable   *int32
			TimeFloat32         float32
			TimeFloat32Nullable *float32
			Measurement         string
			ValueOne            int64
			ValueTwo            int64
		}

		_, err := db.Exec("DROP TABLE IF EXISTS metric_values")
		require.NoError(t, err)
		_, err = db.Exec(`CREATE TABLE metric_values (
			"time" DATETIME NULL,
			timeInt64 BIGINT NOT NULL, timeInt64Nullable BIGINT NULL,
			timeFloat64 FLOAT NOT NULL, timeFloat64Nullable FLOAT NULL,
			timeInt32 INT NOT NULL, timeInt32Nullable INT NULL,
			timeFloat32 FLOAT(11) NOT NULL, timeFloat32Nullable FLOAT(11) NULL,
			measurement VARCHAR(255) NULL, valueOne INTEGER NULL, valueTwo INTEGER NULL
		);
		`)
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
			first := metric_values{
				Time:                t,
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

		for _, m := range series {
			_, err := db.Exec(`INSERT INTO metric_values (
					"time",
					timeInt64, timeInt64Nullable,
					timeFloat64, timeFloat64Nullable,
					timeInt32, timeInt32Nullable,
					timeFloat32, timeFloat32Nullable,
					measurement, valueOne, valueTwo
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, m.Time,
				m.TimeInt64, m.TimeInt64Nullable,
				m.TimeFloat64, m.TimeFloat64Nullable,
				m.TimeInt32, m.TimeInt32Nullable,
				m.TimeFloat32, m.TimeFloat32Nullable,
				m.Measurement, m.ValueOne, m.ValueTwo)
			require.NoError(t, err)
		}

		t.Run("When doing a metric query using epoch (int64) as time column and value column (int64) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT TOP 1 timeInt64 as time, timeInt64 FROM metric_values ORDER BY time",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, tInitial, *frames[0].Fields[0].At(0).(*time.Time))
		})

		t.Run("When doing a metric query using epoch (int64 nullable) as time column and value column (int64 nullable) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT TOP 1 timeInt64Nullable as time, timeInt64Nullable FROM metric_values ORDER BY time",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, tInitial, *frames[0].Fields[0].At(0).(*time.Time))
		})

		t.Run("When doing a metric query using epoch (float64) as time column and value column (float64) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT TOP 1 timeFloat64 as time, timeFloat64 FROM metric_values ORDER BY time",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, tInitial, *frames[0].Fields[0].At(0).(*time.Time))
		})

		t.Run("When doing a metric query using epoch (float64 nullable) as time column and value column (float64 nullable) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT TOP 1 timeFloat64Nullable as time, timeFloat64Nullable FROM metric_values ORDER BY time",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, tInitial, *frames[0].Fields[0].At(0).(*time.Time))
		})

		t.Run("When doing a metric query using epoch (int32) as time column and value column (int32) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT TOP 1 timeInt32 as time, timeInt32 FROM metric_values ORDER BY time",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, tInitial, *frames[0].Fields[0].At(0).(*time.Time))
		})

		t.Run("When doing a metric query using epoch (int32 nullable) as time column and value column (int32 nullable) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT TOP 1 timeInt32Nullable as time, timeInt32Nullable FROM metric_values ORDER BY time",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, tInitial, *frames[0].Fields[0].At(0).(*time.Time))
		})

		t.Run("When doing a metric query using epoch (float32) as time column and value column (float32) should return metric with time in time.Time", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT TOP 1 timeFloat32 as time, timeFloat32 FROM metric_values ORDER BY time",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, tInitial, *frames[0].Fields[0].At(0).(*time.Time))
		})

		t.Run("When doing a metric query using epoch (float32 nullable) as time column and value column (float32 nullable) should return metric with time in milliseconds", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT TOP 1 timeFloat32Nullable as time, timeFloat32Nullable FROM metric_values ORDER BY time",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))

			require.Equal(t, time.Unix(0, int64(float64(float32(tInitial.Unix()))*1e3)*int64(time.Millisecond)), *frames[0].Fields[0].At(0).(*time.Time))
		})

		t.Run("When doing a metric query grouping by time and select metric column should return correct series", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeEpoch(time), measurement + ' - value one' as metric, valueOne FROM metric_values ORDER BY 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.NoError(t, err)
			require.Equal(t, 1, len(frames))

			require.Equal(t, 3, len(frames[0].Fields))
			require.Equal(t, string("Metric A - value one"), frames[0].Fields[1].Name)
			require.Equal(t, string("Metric B - value one"), frames[0].Fields[2].Name)
		})

		t.Run("When doing a metric query grouping by time should return correct series", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeEpoch(time), valueOne, valueTwo FROM metric_values ORDER BY 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.NoError(t, err)
			require.Equal(t, 1, len(frames))
			require.Equal(t, 3, len(frames[0].Fields))
			require.Equal(t, "valueOne", frames[0].Fields[1].Name)
			require.Equal(t, "valueTwo", frames[0].Fields[2].Name)
		})

		t.Run("When doing a metric query with metric column and multiple value columns", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeEpoch(time), measurement, valueOne, valueTwo FROM metric_values ORDER BY 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.NoError(t, err)
			require.Equal(t, 1, len(frames))
			require.Equal(t, 5, len(frames[0].Fields))
			require.Equal(t, "valueOne", frames[0].Fields[1].Name)
			require.Equal(t, data.Labels{"measurement": "Metric A"}, frames[0].Fields[1].Labels)
			require.Equal(t, "valueOne", frames[0].Fields[2].Name)
			require.Equal(t, data.Labels{"measurement": "Metric B"}, frames[0].Fields[2].Labels)
			require.Equal(t, "valueTwo", frames[0].Fields[3].Name)
			require.Equal(t, data.Labels{"measurement": "Metric A"}, frames[0].Fields[3].Labels)
			require.Equal(t, "valueTwo", frames[0].Fields[4].Name)
			require.Equal(t, data.Labels{"measurement": "Metric B"}, frames[0].Fields[4].Labels)
		})

		t.Run("When doing a query with timeFrom,timeTo,unixEpochFrom,unixEpochTo macros", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						TimeRange: backend.TimeRange{
							From: fromStart.Add(-5 * time.Minute),
							To:   fromStart,
						},
						// here we may have to escape
						JSON: []byte(`{
							"rawSql": "SELECT time FROM metric_values WHERE time > $__timeFrom() OR time < $__timeFrom() OR 1 < $__unixEpochFrom() OR $__unixEpochTo() > 1 ORDER BY 1",
							"format": "time_series"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)
			frames := queryResult.Frames
			require.NoError(t, err)
			require.Equal(t, 1, len(frames))
			require.Equal(t, "SELECT time FROM metric_values WHERE time > '2018-03-15T12:55:00Z' OR time < '2018-03-15T12:55:00Z' OR 1 < 1521118500 OR 1521118800 > 1 ORDER BY 1", frames[0].Meta.ExecutedQueryString)
		})

		t.Run("Given a stored procedure that takes @from and @to in epoch time", func(t *testing.T) {
			sql := `
								IF object_id('sp_test_epoch') IS NOT NULL
									DROP PROCEDURE sp_test_epoch
							`

			_, err := db.Exec(sql)
			require.NoError(t, err)

			sql = `
				CREATE PROCEDURE sp_test_epoch(
					@from 		int,
					@to 			int,
					@interval nvarchar(50) = '5m',
					@metric 	nvarchar(200) = 'ALL'
				)	AS
				BEGIN
					DECLARE @dInterval int
					SELECT @dInterval = 300

					IF @interval = '10m'
						SELECT @dInterval = 600

					SELECT
						CAST(ROUND(DATEDIFF(second, '1970-01-01', time)/CAST(@dInterval as float), 0) as bigint)*@dInterval as time,
						measurement as metric,
						avg(valueOne) as valueOne,
						avg(valueTwo) as valueTwo
					FROM
						metric_values
					WHERE
						time BETWEEN DATEADD(s, @from, '1970-01-01') AND DATEADD(s, @to, '1970-01-01') AND
						(@metric = 'ALL' OR measurement = @metric)
					GROUP BY
						CAST(ROUND(DATEDIFF(second, '1970-01-01', time)/CAST(@dInterval as float), 0) as bigint)*@dInterval,
						measurement
					ORDER BY 1
				END
			`

			_, err = db.Exec(sql)
			require.NoError(t, err)

			t.Run("When doing a metric query using stored procedure should return correct result", func(t *testing.T) {
				queryResultTransformer := mssqlQueryResultTransformer{}
				dsInfo := sqleng.DataSourceInfo{}
				config := sqleng.DataPluginConfiguration{
					DSInfo:            dsInfo,
					MetricColumnTypes: []string{"VARCHAR", "CHAR", "NVARCHAR", "NCHAR"},
					RowLimit:          1000000,
				}
				endpoint, err := sqleng.NewQueryDataHandler("", db, config, &queryResultTransformer, newMssqlMacroEngine(), logger)
				require.NoError(t, err)
				query := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							JSON: []byte(`{
								"rawSql": "DECLARE @from int = $__unixEpochFrom(), @to int = $__unixEpochTo() EXEC dbo.sp_test_epoch @from, @to",
								"format": "time_series"
							}`),
							RefID: "A",
							TimeRange: backend.TimeRange{
								From: time.Unix(1521117000, 0),
								To:   time.Unix(1521122100, 0),
							},
						},
					},
				}

				resp, err := endpoint.QueryData(context.Background(), query)
				require.NoError(t, err)
				queryResult := resp.Responses["A"]
				require.NoError(t, queryResult.Error)
				frames := queryResult.Frames
				require.NoError(t, err)
				require.Equal(t, 1, len(frames))
				require.Equal(t, 5, len(frames[0].Fields))
				require.Equal(t, "valueOne", frames[0].Fields[1].Name)
				require.Equal(t, data.Labels{"metric": "Metric A"}, frames[0].Fields[1].Labels)
				require.Equal(t, "valueOne", frames[0].Fields[2].Name)
				require.Equal(t, data.Labels{"metric": "Metric B"}, frames[0].Fields[2].Labels)
				require.Equal(t, "valueTwo", frames[0].Fields[3].Name)
				require.Equal(t, data.Labels{"metric": "Metric A"}, frames[0].Fields[3].Labels)
				require.Equal(t, "valueTwo", frames[0].Fields[4].Name)
				require.Equal(t, data.Labels{"metric": "Metric B"}, frames[0].Fields[4].Labels)
			})
		})

		t.Run("Given a stored procedure that takes @from and @to in datetime", func(t *testing.T) {
			sql := `
								IF object_id('sp_test_datetime') IS NOT NULL
									DROP PROCEDURE sp_test_datetime
							`

			_, err := db.Exec(sql)
			require.NoError(t, err)

			sql = `
				CREATE PROCEDURE sp_test_datetime(
					@from 		datetime,
					@to 			datetime,
					@interval nvarchar(50) = '5m',
					@metric 	nvarchar(200) = 'ALL'
				)	AS
				BEGIN
					DECLARE @dInterval int
					SELECT @dInterval = 300

					IF @interval = '10m'
						SELECT @dInterval = 600

					SELECT
						CAST(ROUND(DATEDIFF(second, '1970-01-01', time)/CAST(@dInterval as float), 0) as bigint)*@dInterval as time,
						measurement as metric,
						avg(valueOne) as valueOne,
						avg(valueTwo) as valueTwo
					FROM
						metric_values
					WHERE
						time BETWEEN @from AND @to AND
						(@metric = 'ALL' OR measurement = @metric)
					GROUP BY
						CAST(ROUND(DATEDIFF(second, '1970-01-01', time)/CAST(@dInterval as float), 0) as bigint)*@dInterval,
						measurement
					ORDER BY 1
				END
			`

			_, err = db.Exec(sql)
			require.NoError(t, err)

			t.Run("When doing a metric query using stored procedure should return correct result", func(t *testing.T) {
				query := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							JSON: []byte(`{
								"rawSql": "DECLARE @from int = $__unixEpochFrom(), @to int = $__unixEpochTo() EXEC dbo.sp_test_epoch @from, @to",
								"format": "time_series"
							}`),
							RefID: "A",
							TimeRange: backend.TimeRange{
								From: time.Unix(1521117000, 0),
								To:   time.Unix(1521122100, 0),
							},
						},
					},
				}

				resp, err := endpoint.QueryData(context.Background(), query)
				require.NoError(t, err)
				queryResult := resp.Responses["A"]
				require.NoError(t, queryResult.Error)

				frames := queryResult.Frames
				require.NoError(t, err)
				require.Equal(t, 1, len(frames))
				require.Equal(t, 5, len(frames[0].Fields))
				require.Equal(t, "valueOne", frames[0].Fields[1].Name)
				require.Equal(t, data.Labels{"metric": "Metric A"}, frames[0].Fields[1].Labels)
				require.Equal(t, "valueOne", frames[0].Fields[2].Name)
				require.Equal(t, data.Labels{"metric": "Metric B"}, frames[0].Fields[2].Labels)
				require.Equal(t, "valueTwo", frames[0].Fields[3].Name)
				require.Equal(t, data.Labels{"metric": "Metric A"}, frames[0].Fields[3].Labels)
				require.Equal(t, "valueTwo", frames[0].Fields[4].Name)
				require.Equal(t, data.Labels{"metric": "Metric B"}, frames[0].Fields[4].Labels)
			})
		})
	})

	t.Run("Given a table with event data", func(t *testing.T) {
		sql := `
			IF OBJECT_ID('dbo.[event]', 'U') IS NOT NULL
				DROP TABLE dbo.[event]

			CREATE TABLE [event] (
				time_sec int,
				description nvarchar(100),
				tags nvarchar(100),
			)
		`

		_, err := db.Exec(sql)
		require.NoError(t, err)

		type event struct {
			TimeSec     int64
			Description string
			Tags        string
		}

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
			sql = fmt.Sprintf(`
							INSERT [event] (time_sec, description, tags)
							VALUES(%d, '%s', '%s')
						`, e.TimeSec, e.Description, e.Tags)

			_, err = db.Exec(sql)
			require.NoError(t, err)
		}

		t.Run("When doing an annotation query of deploy events should return expected result", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT time_sec as time, description as [text], tags FROM [event] WHERE $__unixEpochFilter(time_sec) AND tags='deploy' ORDER BY 1 ASC",
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

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["Deploys"]
			frames := queryResult.Frames
			require.NoError(t, err)
			require.Equal(t, 1, len(frames))
			require.Equal(t, 3, frames[0].Fields[0].Len())
		})

		t.Run("When doing an annotation query of ticket events should return expected result", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT time_sec as time, description as [text], tags FROM [event] WHERE $__unixEpochFilter(time_sec) AND tags='ticket' ORDER BY 1 ASC",
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

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["Tickets"]
			frames := queryResult.Frames
			require.NoError(t, err)
			require.Equal(t, 1, len(frames))
			require.Equal(t, 3, frames[0].Fields[0].Len())
		})

		t.Run("When doing an annotation query with a time column in datetime format", func(t *testing.T) {
			dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)
			const dtFormat = "2006-01-02 15:04:05.999999999"
			queryjson := fmt.Sprintf("{\"rawSql\": \"SELECT CAST('%s' AS DATETIME) as time, 'message' as text, 'tag1,tag2' as tags\", \"format\": \"table\"}", dt.Format(dtFormat))
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON:  []byte(queryjson),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, 1, frames[0].Fields[0].Len())

			// Should be in time.Time
			require.Equal(t, dt, *frames[0].Fields[0].At(0).(*time.Time))
		})

		t.Run("When doing an annotation query with a time column in epoch second format should return ms", func(t *testing.T) {
			dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)
			queryjson := fmt.Sprintf("{\"rawSql\": \"SELECT %d as time, 'message' as text, 'tag1,tag2' as tags\", \"format\": \"table\"}", dt.Unix())

			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON:  []byte(queryjson),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, 1, frames[0].Fields[0].Len())

			// Should be in time.Time
			require.Equal(t, dt.Unix(), (*frames[0].Fields[0].At(0).(*time.Time)).Unix())
		})

		t.Run("When doing an annotation query with a time column in epoch second format (int) should return ms", func(t *testing.T) {
			dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)
			queryjson := fmt.Sprintf("{\"rawSql\": \"SELECT cast(%d as int) as time, 'message' as text, 'tag1,tag2' as tags\", \"format\": \"table\"}", dt.Unix())
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON:  []byte(queryjson),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, 1, frames[0].Fields[0].Len())

			// Should be in time.Time
			require.Equal(t, dt.Unix(), (*frames[0].Fields[0].At(0).(*time.Time)).Unix())
		})

		t.Run("When doing an annotation query with a time column in epoch millisecond format should return ms", func(t *testing.T) {
			dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)
			queryjson := fmt.Sprintf("{\"rawSql\": \"SELECT %d as time, 'message' as text, 'tag1,tag2' as tags\", \"format\": \"table\"}", dt.Unix()*1000)
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON:  []byte(queryjson),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, 1, frames[0].Fields[0].Len())

			// Should be in time.Time
			require.Equal(t, dt.Unix(), (*frames[0].Fields[0].At(0).(*time.Time)).Unix())
		})

		t.Run("When doing an annotation query with a time column holding a bigint null value should return nil", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT cast(null as bigint) as time, 'message' as text, 'tag1,tag2' as tags",
							"format": "table"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, 1, frames[0].Fields[0].Len())

			// Should be in time.Time
			require.Nil(t, frames[0].Fields[0].At(0))
		})

		t.Run("When doing an annotation query with a time column holding a datetime null value should return nil", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT cast(null as datetime) as time, 'message' as text, 'tag1,tag2' as tags",
							"format": "table"
						}`),
						RefID: "A",
					},
				},
			}

			resp, err := endpoint.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, 1, frames[0].Fields[0].Len())

			// Should be in time.Time
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

			resp, err := endpoint.QueryData(context.Background(), query)
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
			queryResultTransformer := mssqlQueryResultTransformer{}
			dsInfo := sqleng.DataSourceInfo{}
			config := sqleng.DataPluginConfiguration{
				DSInfo:            dsInfo,
				MetricColumnTypes: []string{"VARCHAR", "CHAR", "NVARCHAR", "NCHAR"},
				RowLimit:          1,
			}

			handler, err := sqleng.NewQueryDataHandler("", db, config, &queryResultTransformer, newMssqlMacroEngine(), logger)
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
		_, err := db.Exec("DROP TABLE IF EXISTS empty_obj")
		require.NoError(t, err)

		_, err = db.Exec("CREATE TABLE empty_obj (empty_key VARCHAR(255) NULL, empty_val BIGINT NULL)")
		require.NoError(t, err)

		t.Run("When no rows are returned, should return an empty frame", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT empty_key, empty_val FROM empty_obj",
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

			resp, err := endpoint.QueryData(context.Background(), query)
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

func TestTransformQueryError(t *testing.T) {
	transformer := &mssqlQueryResultTransformer{}

	logger := backend.NewLoggerWith("logger", "mssql.test")

	t.Run("Should not return a connection error", func(t *testing.T) {
		err := fmt.Errorf("Unable to open tcp connection with host 'localhost:5000': dial tcp: connection refused")
		resultErr := transformer.TransformQueryError(logger, err)
		errorText := resultErr.Error()
		assert.NotEqual(t, err, resultErr)
		assert.NotContains(t, errorText, "Unable to open tcp connection with host")
		assert.Contains(t, errorText, "failed to connect to server")
	})

	t.Run("Should return a non-connection error unmodified", func(t *testing.T) {
		err := fmt.Errorf("normal error")
		resultErr := transformer.TransformQueryError(logger, err)
		assert.Equal(t, err, resultErr)
		assert.ErrorIs(t, err, resultErr)
	})
}

func TestGenerateConnectionString(t *testing.T) {
	kerberosLookup := []kerberos.KerberosLookup{
		{
			Address:                 "example.host",
			DBName:                  "testDB",
			User:                    "testUser",
			CredentialCacheFilename: "/tmp/cache",
		},
	}
	tmpFile := genTempCacheFile(t, kerberosLookup)
	defer func() {
		err := os.Remove(tmpFile)
		if err != nil {
			t.Log(err)
		}
	}()

	testCases := []struct {
		desc        string
		kerberosCfg kerberos.KerberosAuth
		dataSource  sqleng.DataSourceInfo
		expConnStr  string
	}{
		{
			desc: "Use Kerberos Credential Cache",
			kerberosCfg: kerberos.KerberosAuth{
				CredentialCache:    "/tmp/krb5cc_1000",
				ConfigFilePath:     "/etc/krb5.conf",
				UDPConnectionLimit: 1,
			},
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost",
				Database: "database",
				JsonData: sqleng.JsonData{
					AuthenticationType: "Windows AD: Credential cache",
				},
			},
			expConnStr: "authenticator=krb5;krb5-configfile=/etc/krb5.conf;server=localhost;database=database;krb5-credcachefile=/tmp/krb5cc_1000;",
		},
		{
			desc: "Use Kerberos Credential Cache File path",
			kerberosCfg: kerberos.KerberosAuth{
				CredentialCacheLookupFile: tmpFile,
				ConfigFilePath:            "/etc/krb5.conf",
				UDPConnectionLimit:        1,
			},
			dataSource: sqleng.DataSourceInfo{
				URL:      "example.host",
				Database: "testDB",
				User:     "testUser",
				JsonData: sqleng.JsonData{
					AuthenticationType: "Windows AD: Credential cache file",
				},
			},
			expConnStr: "authenticator=krb5;krb5-configfile=/etc/krb5.conf;server=example.host;database=testDB;krb5-credcachefile=/tmp/cache;",
		},
		{
			desc: "Use Kerberos Keytab",
			kerberosCfg: kerberos.KerberosAuth{
				KeytabFilePath:     "/foo/bar.keytab",
				ConfigFilePath:     "/etc/krb5.conf",
				UDPConnectionLimit: 1,
			},
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost",
				Database: "database",
				User:     "foo@test.lab",
				JsonData: sqleng.JsonData{
					AuthenticationType: "Windows AD: Keytab",
				},
			},
			expConnStr: "authenticator=krb5;krb5-configfile=/etc/krb5.conf;server=localhost;database=database;user id=foo@test.lab;krb5-keytabfile=/foo/bar.keytab;",
		},
		{
			desc: "Use Kerberos Username and Password",
			kerberosCfg: kerberos.KerberosAuth{
				ConfigFilePath:     "/etc/krb5.conf",
				UDPConnectionLimit: 1,
			},
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost",
				Database: "database",
				User:     "foo@test.lab",
				DecryptedSecureJSONData: map[string]string{
					"password": "foo",
				},
				JsonData: sqleng.JsonData{
					AuthenticationType: "Windows AD: Username + password",
				},
			},
			expConnStr: "authenticator=krb5;krb5-configfile=/etc/krb5.conf;server=localhost;database=database;user id=foo@test.lab;password=foo;",
		},
		{
			desc: "Use non-default UDP connection limit",
			kerberosCfg: kerberos.KerberosAuth{
				ConfigFilePath:     "/etc/krb5.conf",
				UDPConnectionLimit: 0,
			},
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost",
				Database: "database",
				User:     "foo@test.lab",
				DecryptedSecureJSONData: map[string]string{
					"password": "foo",
				},
				JsonData: sqleng.JsonData{
					AuthenticationType: "Windows AD: Username + password",
				},
			},
			expConnStr: "authenticator=krb5;krb5-configfile=/etc/krb5.conf;server=localhost;database=database;user id=foo@test.lab;password=foo;krb5-udppreferencelimit=0;",
		},

		{
			desc: "From URL w/ port",
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost:1001",
				Database: "database",
				User:     "user",
				JsonData: sqleng.JsonData{},
			},
			expConnStr: "server=localhost;database=database;user id=user;password=;port=1001;",
		},
		// When no port is specified, the driver should be allowed to choose
		{
			desc: "From URL w/o port",
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost",
				Database: "database",
				User:     "user",
				JsonData: sqleng.JsonData{},
			},
			expConnStr: "server=localhost;database=database;user id=user;password=;",
		},
		// Port 0 should be equivalent to not specifying a port, i.e. let the driver choose
		{
			desc: "From URL w port 0",
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost:0",
				Database: "database",
				User:     "user",
				JsonData: sqleng.JsonData{},
			},
			expConnStr: "server=localhost;database=database;user id=user;password=;",
		},
		{
			desc: "With instance name",
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost\\instance",
				Database: "database",
				User:     "user",
				JsonData: sqleng.JsonData{},
			},
			expConnStr: "server=localhost\\instance;database=database;user id=user;password=;",
		},
		{
			desc: "With instance name and port",
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost\\instance:333",
				Database: "database",
				User:     "user",
				JsonData: sqleng.JsonData{},
			},
			expConnStr: "server=localhost\\instance;database=database;user id=user;password=;port=333;",
		},
		{
			desc: "With instance name and ApplicationIntent",
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost\\instance;ApplicationIntent=ReadOnly",
				Database: "database",
				User:     "user",
				JsonData: sqleng.JsonData{},
			},
			expConnStr: "server=localhost\\instance;ApplicationIntent=ReadOnly;database=database;user id=user;password=;",
		},
		{
			desc: "With ApplicationIntent instance name and port",
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost\\instance:333;ApplicationIntent=ReadOnly",
				Database: "database",
				User:     "user",
				JsonData: sqleng.JsonData{},
			},
			expConnStr: "server=localhost\\instance;database=database;user id=user;password=;port=333;ApplicationIntent=ReadOnly;",
		},
		{
			desc: "With instance name",
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost\\instance",
				Database: "database",
				User:     "user",
				JsonData: sqleng.JsonData{},
			},
			expConnStr: "server=localhost\\instance;database=database;user id=user;password=;",
		},
		{
			desc: "With instance name and port",
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost\\instance:333",
				Database: "database",
				User:     "user",
				JsonData: sqleng.JsonData{},
			},
			expConnStr: "server=localhost\\instance;database=database;user id=user;password=;port=333;",
		},
		{
			desc: "With instance name and ApplicationIntent",
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost\\instance;ApplicationIntent=ReadOnly",
				Database: "database",
				User:     "user",
				JsonData: sqleng.JsonData{},
			},
			expConnStr: "server=localhost\\instance;ApplicationIntent=ReadOnly;database=database;user id=user;password=;",
		},
		{
			desc: "With ApplicationIntent instance name and port",
			dataSource: sqleng.DataSourceInfo{
				URL:      "localhost\\instance:333;ApplicationIntent=ReadOnly",
				Database: "database",
				User:     "user",
				JsonData: sqleng.JsonData{},
			},
			expConnStr: "server=localhost\\instance;database=database;user id=user;password=;port=333;ApplicationIntent=ReadOnly;",
		},
		{
			desc: "Defaults",
			dataSource: sqleng.DataSourceInfo{
				Database: "database",
				User:     "user",
				JsonData: sqleng.JsonData{},
			},
			expConnStr: "server=localhost;database=database;user id=user;password=;",
		},
	}

	logger := backend.NewLoggerWith("logger", "mssql.test")

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			connStr, err := generateConnectionString(tc.dataSource, "", false, nil, tc.kerberosCfg, logger)
			require.NoError(t, err)
			assert.Equal(t, tc.expConnStr, connStr)
		})
	}
}

func initMSSQLTestDB(t *testing.T, jsonData sqleng.JsonData) *sql.DB {
	t.Helper()

	host := os.Getenv("MSSQL_HOST")
	if host == "" {
		host = serverIP
	}
	port := os.Getenv("MSSQL_PORT")
	if port == "" {
		port = "1433"
	}

	db, err := sql.Open("mssql", fmt.Sprintf("server=%s;port=%s;database=grafanatest;user id=grafana;password=Password!", host, port))
	require.NoError(t, err)

	db.SetMaxOpenConns(jsonData.MaxOpenConns)
	db.SetMaxIdleConns(jsonData.MaxIdleConns)
	db.SetConnMaxLifetime(time.Duration(jsonData.ConnMaxLifetime) * time.Second)

	return db
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

func genTempCacheFile(t *testing.T, lookups []kerberos.KerberosLookup) string {
	content, err := json.Marshal(lookups)
	if err != nil {
		t.Fatalf("Unable to marshall json for temp lookup: %v", err)
	}

	tmpFile, err := os.CreateTemp("", "lookup*.json")
	if err != nil {
		t.Fatalf("Unable to create temporary file for temp lookup: %v", err)
	}

	if _, err := tmpFile.Write(content); err != nil {
		t.Fatalf("Unable to write to temporary file for temp lookup: %v", err)
	}

	return tmpFile.Name()
}
