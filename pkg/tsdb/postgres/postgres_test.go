// +build integration

package postgres

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"xorm.io/xorm"

	_ "github.com/lib/pq"
)

// Test generateConnectionString.
func TestGenerateConnectionString(t *testing.T) {
	logger := log.New("tsdb.postgres")

	testCases := []struct {
		desc       string
		host       string
		user       string
		password   string
		database   string
		tlsMode    string
		expConnStr string
		expErr     string
	}{
		{
			desc:       "Unix socket host",
			host:       "/var/run/postgresql",
			user:       "user",
			password:   "password",
			database:   "database",
			expConnStr: "user='user' password='password' host='/var/run/postgresql' dbname='database' sslmode='verify-full'",
		},
		{
			desc:       "TCP host",
			host:       "host",
			user:       "user",
			password:   "password",
			database:   "database",
			expConnStr: "user='user' password='password' host='host' dbname='database' sslmode='verify-full'",
		},
		{
			desc:       "TCP/port host",
			host:       "host:1234",
			user:       "user",
			password:   "password",
			database:   "database",
			expConnStr: "user='user' password='password' host='host' dbname='database' sslmode='verify-full' port=1234",
		},
		{
			desc:     "Invalid port",
			host:     "host:invalid",
			user:     "user",
			database: "database",
			expErr:   "invalid port in host specifier",
		},
		{
			desc:       "Password with single quote and backslash",
			host:       "host",
			user:       "user",
			password:   `p'\assword`,
			database:   "database",
			expConnStr: `user='user' password='p\'\\assword' host='host' dbname='database' sslmode='verify-full'`,
		},
		{
			desc:       "Custom TLS/SSL mode",
			host:       "host",
			user:       "user",
			password:   "password",
			database:   "database",
			tlsMode:    "disable",
			expConnStr: "user='user' password='password' host='host' dbname='database' sslmode='disable'",
		},
	}
	for _, tt := range testCases {
		t.Run(tt.desc, func(t *testing.T) {
			data := map[string]interface{}{}
			if tt.tlsMode != "" {
				data["sslmode"] = tt.tlsMode
			}
			ds := &models.DataSource{
				Url:      tt.host,
				User:     tt.user,
				Password: tt.password,
				Database: tt.database,
				JsonData: simplejson.NewFromAny(data),
			}
			connStr, err := generateConnectionString(ds, logger)
			if tt.expErr == "" {
				require.NoError(t, err, tt.desc)
				assert.Equal(t, tt.expConnStr, connStr, tt.desc)
			} else {
				require.Error(t, err, tt.desc)
				assert.True(t, strings.HasPrefix(err.Error(), tt.expErr),
					fmt.Sprintf("%s: %q doesn't start with %q", tt.desc, err, tt.expErr))
			}
		})
	}
}

// To run this test, set runPostgresTests=true
// Or from the commandline: GRAFANA_TEST_DB=postgres go test -v ./pkg/tsdb/postgres
// The tests require a PostgreSQL db named grafanadstest and a user/password grafanatest/grafanatest!
// Use the docker/blocks/postgres_tests/docker-compose.yaml to spin up a
// preconfigured Postgres server suitable for running these tests.
// There is also a datasource and dashboard provisioned by devenv scripts that you can
// use to verify that the generated data are visualized as expected, see
// devenv/README.md for setup instructions.
func TestPostgres(t *testing.T) {
	// change to true to run the PostgreSQL tests
	runPostgresTests := false
	// runPostgresTests := true

	if !(sqlstore.IsTestDbPostgres() || runPostgresTests) {
		t.Skip()
	}

	x := InitPostgresTestDB(t)

	origXormEngine := sqleng.NewXormEngine
	origInterpolate := sqleng.Interpolate
	t.Cleanup(func() {
		sqleng.NewXormEngine = origXormEngine
		sqleng.Interpolate = origInterpolate
	})
	sqleng.NewXormEngine = func(d, c string) (*xorm.Engine, error) {
		return x, nil
	}
	sqleng.Interpolate = func(query *tsdb.Query, timeRange *tsdb.TimeRange, sql string) (string, error) {
		return sql, nil
	}

	endpoint, err := newPostgresQueryEndpoint(&models.DataSource{
		JsonData:       simplejson.New(),
		SecureJsonData: securejsondata.SecureJsonData{},
	})
	require.NoError(t, err)

	sess := x.NewSession()
	t.Cleanup(sess.Close)
	fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)

	t.Run("Given a table with different native data types", func(t *testing.T) {
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
		require.NoError(t, err)

		sql = `
			INSERT INTO postgres_types VALUES(
				1,2,3,
				4.5,6.7,1.1,1.2,
				'char10','varchar10','text',

				now(),now(),now(),now(),now(),'15m'::interval
			);
		`
		_, err = sess.Exec(sql)
		require.NoError(t, err)

		t.Run("When doing a table query should map Postgres column types to Go types", func(t *testing.T) {
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

			resp, err := endpoint.Query(context.Background(), nil, query)
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)

			column := queryResult.Tables[0].Rows[0]
			require.Equal(t, int64(1), column[0].(int64))
			require.Equal(t, int64(2), column[1].(int64))
			require.Equal(t, int64(3), column[2].(int64))

			require.Equal(t, float64(4.5), column[3].(float64))
			require.Equal(t, float64(6.7), column[4].(float64))
			require.Equal(t, float64(1.1), column[5].(float64))
			require.Equal(t, float64(1.2), column[6].(float64))

			require.Equal(t, "char10    ", column[7].(string))
			require.Equal(t, "varchar10", column[8].(string))
			require.Equal(t, "text", column[9].(string))

			_, ok := column[10].(time.Time)
			require.True(t, ok)
			_, ok = column[11].(time.Time)
			require.True(t, ok)
			_, ok = column[12].(time.Time)
			require.True(t, ok)
			_, ok = column[13].(time.Time)
			require.True(t, ok)
			_, ok = column[14].(time.Time)
			require.True(t, ok)

			require.Equal(t, "00:15:00", column[15].(string))
		})
	})

	t.Run("Given a table with metrics that lacks data for some series ", func(t *testing.T) {
		sql := `
				DROP TABLE IF EXISTS metric;
				CREATE TABLE metric (
					time timestamp,
					value integer
				)
			`

		_, err := sess.Exec(sql)
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

		_, err = sess.InsertMulti(series)
		require.NoError(t, err)

		t.Run("When doing a metric query using timeGroup", func(t *testing.T) {
			query := &tsdb.TsdbQuery{
				Queries: []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"rawSql": "SELECT $__timeGroup(time, '5m') AS time, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
							"format": "time_series",
						}),
						RefId: "A",
					},
				},
			}

			resp, err := endpoint.Query(context.Background(), nil, query)
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)

			points := queryResult.Series[0].Points
			// without fill this should result in 4 buckets
			require.Len(t, points, 4)

			dt := fromStart

			for i := 0; i < 2; i++ {
				aValue := points[i][0].Float64
				aTime := time.Unix(int64(points[i][1].Float64)/1000, 0)
				require.Equal(t, float64(15), aValue)
				require.Equal(t, dt, aTime)
				require.Equal(t, int64(0), aTime.Unix()%300)
				dt = dt.Add(5 * time.Minute)
			}

			// adjust for 10 minute gap between first and second set of points
			dt = dt.Add(10 * time.Minute)
			for i := 2; i < 4; i++ {
				aValue := points[i][0].Float64
				aTime := time.Unix(int64(points[i][1].Float64)/1000, 0)
				require.Equal(t, float64(20), aValue)
				require.Equal(t, dt, aTime)
				dt = dt.Add(5 * time.Minute)
			}
		})

		t.Run("When doing a metric query using timeGroup and $__interval", func(t *testing.T) {
			mockInterpolate := sqleng.Interpolate
			sqleng.Interpolate = origInterpolate
			t.Cleanup(func() {
				sqleng.Interpolate = mockInterpolate
			})

			query := &tsdb.TsdbQuery{
				Queries: []*tsdb.Query{
					{
						DataSource: &models.DataSource{},
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
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)
			require.Equal(t,
				"SELECT floor(extract(epoch from time)/60)*60 AS time, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
				queryResult.Meta.Get(sqleng.MetaKeyExecutedQueryString).MustString())
		})

		t.Run("When doing a metric query using timeGroup with NULL fill enabled", func(t *testing.T) {
			query := &tsdb.TsdbQuery{
				Queries: []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"rawSql": "SELECT $__timeGroup(time, '5m', NULL) AS time, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
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
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)

			points := queryResult.Series[0].Points
			require.Len(t, points, 7)

			dt := fromStart

			for i := 0; i < 2; i++ {
				aValue := points[i][0].Float64
				aTime := time.Unix(int64(points[i][1].Float64)/1000, 0)
				require.Equal(t, float64(15), aValue)
				require.Equal(t, dt, aTime)
				dt = dt.Add(5 * time.Minute)
			}

			// check for NULL values inserted by fill
			require.False(t, points[2][0].Valid)
			require.False(t, points[3][0].Valid)

			// adjust for 10 minute gap between first and second set of points
			dt = dt.Add(10 * time.Minute)
			for i := 4; i < 6; i++ {
				aValue := points[i][0].Float64
				aTime := time.Unix(int64(points[i][1].Float64)/1000, 0)
				require.Equal(t, float64(20), aValue)
				require.Equal(t, dt, aTime)
				dt = dt.Add(5 * time.Minute)
			}

			// check for NULL values inserted by fill
			require.False(t, points[6][0].Valid)
		})

		t.Run("When doing a metric query using timeGroup with value fill enabled", func(t *testing.T) {
			query := &tsdb.TsdbQuery{
				Queries: []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"rawSql": "SELECT $__timeGroup(time, '5m', 1.5) AS time, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
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
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)

			points := queryResult.Series[0].Points
			require.Equal(t, float64(1.5), points[3][0].Float64)
		})
	})

	t.Run("When doing a metric query using timeGroup with previous fill enabled", func(t *testing.T) {
		query := &tsdb.TsdbQuery{
			Queries: []*tsdb.Query{
				{
					Model: simplejson.NewFromAny(map[string]interface{}{
						"rawSql": "SELECT $__timeGroup(time, '5m', previous), avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
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
		require.NoError(t, err)
		queryResult := resp.Results["A"]
		require.NoError(t, queryResult.Error)

		points := queryResult.Series[0].Points
		require.Equal(t, float64(15.0), points[2][0].Float64)
		require.Equal(t, float64(15.0), points[3][0].Float64)
		require.Equal(t, float64(20.0), points[6][0].Float64)
	})

	t.Run("Given a table with metrics having multiple values and measurements", func(t *testing.T) {
		type metric_values struct {
			Time                time.Time
			TimeInt64           int64    `xorm:"bigint 'timeInt64' not null"`
			TimeInt64Nullable   *int64   `xorm:"bigint 'timeInt64Nullable' null"`
			TimeFloat64         float64  `xorm:"double 'timeFloat64' not null"`
			TimeFloat64Nullable *float64 `xorm:"double 'timeFloat64Nullable' null"`
			TimeInt32           int32    `xorm:"int(11) 'timeInt32' not null"`
			TimeInt32Nullable   *int32   `xorm:"int(11) 'timeInt32Nullable' null"`
			TimeFloat32         float32  `xorm:"double 'timeFloat32' not null"`
			TimeFloat32Nullable *float32 `xorm:"double 'timeFloat32Nullable' null"`
			Measurement         string
			ValueOne            int64 `xorm:"integer 'valueOne'"`
			ValueTwo            int64 `xorm:"integer 'valueTwo'"`
		}

		if exist, err := sess.IsTableExist(metric_values{}); err != nil || exist {
			require.NoError(t, err)
			err = sess.DropTable(metric_values{})
			require.NoError(t, err)
		}
		err := sess.CreateTable(metric_values{})
		require.NoError(t, err)

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

		_, err = sess.InsertMulti(series)
		require.NoError(t, err)

		t.Run(
			"When doing a metric query using epoch (int64) as time column and value column (int64) should return metric with time in milliseconds",
			func(t *testing.T) {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT "timeInt64" as time, "timeInt64" FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				require.NoError(t, err)
				queryResult := resp.Results["A"]
				require.NoError(t, queryResult.Error)

				require.Equal(t, 1, len(queryResult.Series))
				require.Equal(t, float64(tInitial.UnixNano()/1e6), queryResult.Series[0].Points[0][1].Float64)
			})

		t.Run("When doing a metric query using epoch (int64 nullable) as time column and value column (int64 nullable,) should return metric with time in milliseconds",
			func(t *testing.T) {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT "timeInt64Nullable" as time, "timeInt64Nullable" FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				require.NoError(t, err)
				queryResult := resp.Results["A"]
				require.NoError(t, queryResult.Error)

				require.Len(t, queryResult.Series, 1)
				require.Equal(t, float64(tInitial.UnixNano()/1e6), queryResult.Series[0].Points[0][1].Float64)
			})

		t.Run("When doing a metric query using epoch (float64) as time column and value column (float64), should return metric with time in milliseconds",
			func(t *testing.T) {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT "timeFloat64" as time, "timeFloat64" FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				require.NoError(t, err)
				queryResult := resp.Results["A"]
				require.NoError(t, queryResult.Error)

				require.Len(t, queryResult.Series, 1)
				require.Equal(t, float64(tInitial.UnixNano()/1e6), queryResult.Series[0].Points[0][1].Float64)
			})

		t.Run("When doing a metric query using epoch (float64 nullable) as time column and value column (float64 nullable), should return metric with time in milliseconds",
			func(t *testing.T) {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT "timeFloat64Nullable" as time, "timeFloat64Nullable" FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				require.NoError(t, err)
				queryResult := resp.Results["A"]
				require.NoError(t, queryResult.Error)

				require.Len(t, queryResult.Series, 1)
				require.Equal(t, float64(tInitial.UnixNano()/1e6), queryResult.Series[0].Points[0][1].Float64)
			})

		t.Run("When doing a metric query using epoch (int32) as time column and value column (int32), should return metric with time in milliseconds",
			func(t *testing.T) {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT "timeInt32" as time, "timeInt32" FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				require.NoError(t, err)
				queryResult := resp.Results["A"]
				require.NoError(t, queryResult.Error)

				require.Len(t, queryResult.Series, 1)
				require.Equal(t, float64(tInitial.UnixNano()/1e6), queryResult.Series[0].Points[0][1].Float64)
			})

		t.Run("When doing a metric query using epoch (int32 nullable) as time column and value column (int32 nullable), should return metric with time in milliseconds",
			func(t *testing.T) {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT "timeInt32Nullable" as time, "timeInt32Nullable" FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				require.NoError(t, err)
				queryResult := resp.Results["A"]
				require.NoError(t, queryResult.Error)

				require.Len(t, queryResult.Series, 1)
				require.Equal(t, float64(tInitial.UnixNano()/1e6), queryResult.Series[0].Points[0][1].Float64)
			})

		t.Run("When doing a metric query using epoch (float32) as time column and value column (float32), should return metric with time in milliseconds",
			func(t *testing.T) {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT "timeFloat32" as time, "timeFloat32" FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				require.NoError(t, err)
				queryResult := resp.Results["A"]
				require.NoError(t, queryResult.Error)

				require.Len(t, queryResult.Series, 1)
				require.Equal(t, float64(float32(tInitial.Unix()))*1e3, queryResult.Series[0].Points[0][1].Float64)
			})

		t.Run("When doing a metric query using epoch (float32 nullable) as time column and value column (float32 nullable), should return metric with time in milliseconds",
			func(t *testing.T) {
				query := &tsdb.TsdbQuery{
					Queries: []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"rawSql": `SELECT "timeFloat32Nullable" as time, "timeFloat32Nullable" FROM metric_values ORDER BY time LIMIT 1`,
								"format": "time_series",
							}),
							RefId: "A",
						},
					},
				}

				resp, err := endpoint.Query(context.Background(), nil, query)
				require.NoError(t, err)
				queryResult := resp.Results["A"]
				require.NoError(t, queryResult.Error)

				require.Len(t, queryResult.Series, 1)
				require.Equal(t, float64(float32(tInitial.Unix()))*1e3, queryResult.Series[0].Points[0][1].Float64)
			})

		t.Run("When doing a metric query grouping by time and select metric column should return correct series", func(t *testing.T) {
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

			resp, err := endpoint.Query(context.Background(), nil, query)
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)

			require.Len(t, queryResult.Series, 2)
			require.Equal(t, "Metric A - value one", queryResult.Series[0].Name)
			require.Equal(t, "Metric B - value one", queryResult.Series[1].Name)
		})

		t.Run("When doing a metric query with metric column and multiple value columns", func(t *testing.T) {
			query := &tsdb.TsdbQuery{
				Queries: []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"rawSql": `SELECT $__timeEpoch(time), measurement as metric, "valueOne", "valueTwo" FROM metric_values ORDER BY 1`,
							"format": "time_series",
						}),
						RefId: "A",
					},
				},
			}

			resp, err := endpoint.Query(context.Background(), nil, query)
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)

			require.Len(t, queryResult.Series, 4)
			require.Equal(t, "Metric A valueOne", queryResult.Series[0].Name)
			require.Equal(t, "Metric A valueTwo", queryResult.Series[1].Name)
			require.Equal(t, "Metric B valueOne", queryResult.Series[2].Name)
			require.Equal(t, "Metric B valueTwo", queryResult.Series[3].Name)
		})

		t.Run("When doing a metric query grouping by time should return correct series", func(t *testing.T) {
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

			resp, err := endpoint.Query(context.Background(), nil, query)
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)

			require.Len(t, queryResult.Series, 2)
			require.Equal(t, "valueOne", queryResult.Series[0].Name)
			require.Equal(t, "valueTwo", queryResult.Series[1].Name)
		})

		t.Run("When doing a query with timeFrom,timeTo,unixEpochFrom,unixEpochTo macros", func(t *testing.T) {
			fakeInterpolate := sqleng.Interpolate
			t.Cleanup(func() {
				sqleng.Interpolate = fakeInterpolate
			})
			sqleng.Interpolate = origInterpolate

			query := &tsdb.TsdbQuery{
				TimeRange: tsdb.NewFakeTimeRange("5m", "now", fromStart),
				Queries: []*tsdb.Query{
					{
						DataSource: &models.DataSource{JsonData: simplejson.New()},
						Model: simplejson.NewFromAny(map[string]interface{}{
							"rawSql": `SELECT time FROM metric_values WHERE time > $__timeFrom() OR time < $__timeFrom() OR 1 < $__unixEpochFrom() OR $__unixEpochTo() > 1 ORDER BY 1`,
							"format": "time_series",
						}),
						RefId: "A",
					},
				},
			}

			resp, err := endpoint.Query(context.Background(), nil, query)
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)
			require.Equal(t,
				"SELECT time FROM metric_values WHERE time > '2018-03-15T12:55:00Z' OR time < '2018-03-15T12:55:00Z' OR 1 < 1521118500 OR 1521118800 > 1 ORDER BY 1",
				queryResult.Meta.Get(sqleng.MetaKeyExecutedQueryString).MustString())
		})
	})

	t.Run("Given a table with event data", func(t *testing.T) {
		type event struct {
			TimeSec     int64
			Description string
			Tags        string
		}

		if exists, err := sess.IsTableExist(event{}); err != nil || exists {
			require.NoError(t, err)
			err := sess.DropTable(event{})
			require.NoError(t, err)
		}
		err := sess.CreateTable(event{})
		require.NoError(t, err)

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
			_, err := sess.Insert(e)
			require.NoError(t, err)
		}

		t.Run("When doing an annotation query of deploy events should return expected result", func(t *testing.T) {
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

			resp, err := endpoint.Query(context.Background(), nil, query)
			queryResult := resp.Results["Deploys"]
			require.NoError(t, err)
			require.Len(t, queryResult.Tables[0].Rows, 3)
		})

		t.Run("When doing an annotation query of ticket events should return expected result", func(t *testing.T) {
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

			resp, err := endpoint.Query(context.Background(), nil, query)
			queryResult := resp.Results["Tickets"]
			require.NoError(t, err)
			require.Len(t, queryResult.Tables[0].Rows, 3)
		})

		t.Run("When doing an annotation query with a time column in datetime format", func(t *testing.T) {
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

			resp, err := endpoint.Query(context.Background(), nil, query)
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)
			require.Len(t, queryResult.Tables[0].Rows, 1)
			columns := queryResult.Tables[0].Rows[0]

			//Should be in milliseconds
			require.Equal(t, float64(dt.UnixNano()/1e6), columns[0].(float64))
		})

		t.Run("When doing an annotation query with a time column in epoch second format should return ms", func(t *testing.T) {
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

			resp, err := endpoint.Query(context.Background(), nil, query)
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)
			require.Len(t, queryResult.Tables[0].Rows, 1)
			columns := queryResult.Tables[0].Rows[0]

			//Should be in milliseconds
			require.Equal(t, dt.Unix()*1000, columns[0].(int64))
		})

		t.Run("When doing an annotation query with a time column in epoch second format (t *testing.Tint) should return ms", func(t *testing.T) {
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

			resp, err := endpoint.Query(context.Background(), nil, query)
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)
			require.Len(t, queryResult.Tables[0].Rows, 1)
			columns := queryResult.Tables[0].Rows[0]

			//Should be in milliseconds
			require.Equal(t, dt.Unix()*1000, columns[0].(int64))
		})

		t.Run("When doing an annotation query with a time column in epoch millisecond format should return ms", func(t *testing.T) {
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

			resp, err := endpoint.Query(context.Background(), nil, query)
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)
			require.Len(t, queryResult.Tables[0].Rows, 1)
			columns := queryResult.Tables[0].Rows[0]

			//Should be in milliseconds
			require.Equal(t, dt.Unix()*1000, columns[0].(int64))
		})

		t.Run("When doing an annotation query with a time column holding a bigint null value should return nil", func(t *testing.T) {
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

			resp, err := endpoint.Query(context.Background(), nil, query)
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)
			require.Len(t, queryResult.Tables[0].Rows, 1)
			columns := queryResult.Tables[0].Rows[0]

			//Should be in milliseconds
			require.Nil(t, columns[0])
		})

		t.Run("When doing an annotation query with a time column holding a timestamp null value should return nil", func(t *testing.T) {
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

			resp, err := endpoint.Query(context.Background(), nil, query)
			require.NoError(t, err)
			queryResult := resp.Results["A"]
			require.NoError(t, queryResult.Error)
			require.Len(t, queryResult.Tables[0].Rows, 1)
			columns := queryResult.Tables[0].Rows[0]

			//Should be in milliseconds
			assert.Nil(t, columns[0])
		})
	})
}

func InitPostgresTestDB(t *testing.T) *xorm.Engine {
	testDB := sqlutil.PostgresTestDB()
	x, err := xorm.NewEngine(testDB.DriverName, strings.Replace(testDB.ConnStr, "dbname=grafanatest",
		"dbname=grafanadstest", 1))
	if err != nil {
		t.Fatalf("Failed to init postgres DB %v", err)
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
