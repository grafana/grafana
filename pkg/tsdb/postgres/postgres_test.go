//go:build integration
// +build integration

package postgres

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"xorm.io/xorm"

	_ "github.com/lib/pq"
)

// Test generateConnectionString.
func TestIntegrationGenerateConnectionString(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.DataPath = t.TempDir()

	testCases := []struct {
		desc        string
		host        string
		user        string
		password    string
		database    string
		tlsSettings tlsSettings
		expConnStr  string
		expErr      string
		uid         string
	}{
		{
			desc:        "Unix socket host",
			host:        "/var/run/postgresql",
			user:        "user",
			password:    "password",
			database:    "database",
			tlsSettings: tlsSettings{Mode: "verify-full"},
			expConnStr:  "user='user' password='password' host='/var/run/postgresql' dbname='database' sslmode='verify-full'",
		},
		{
			desc:        "TCP host",
			host:        "host",
			user:        "user",
			password:    "password",
			database:    "database",
			tlsSettings: tlsSettings{Mode: "verify-full"},
			expConnStr:  "user='user' password='password' host='host' dbname='database' sslmode='verify-full'",
		},
		{
			desc:        "TCP/port host",
			host:        "host:1234",
			user:        "user",
			password:    "password",
			database:    "database",
			tlsSettings: tlsSettings{Mode: "verify-full"},
			expConnStr:  "user='user' password='password' host='host' dbname='database' port=1234 sslmode='verify-full'",
		},
		{
			desc:        "Ipv6 host",
			host:        "[::1]",
			user:        "user",
			password:    "password",
			database:    "database",
			tlsSettings: tlsSettings{Mode: "verify-full"},
			expConnStr:  "user='user' password='password' host='::1' dbname='database' sslmode='verify-full'",
		},
		{
			desc:        "Ipv6/port host",
			host:        "[::1]:1234",
			user:        "user",
			password:    "password",
			database:    "database",
			tlsSettings: tlsSettings{Mode: "verify-full"},
			expConnStr:  "user='user' password='password' host='::1' dbname='database' port=1234 sslmode='verify-full'",
		},
		{
			desc:        "Invalid port",
			host:        "host:invalid",
			user:        "user",
			database:    "database",
			tlsSettings: tlsSettings{},
			expErr:      "invalid port in host specifier",
		},
		{
			desc:        "Password with single quote and backslash",
			host:        "host",
			user:        "user",
			password:    `p'\assword`,
			database:    "database",
			tlsSettings: tlsSettings{Mode: "verify-full"},
			expConnStr:  `user='user' password='p\'\\assword' host='host' dbname='database' sslmode='verify-full'`,
		},
		{
			desc:        "User/DB with single quote and backslash",
			host:        "host",
			user:        `u'\ser`,
			password:    `password`,
			database:    `d'\atabase`,
			tlsSettings: tlsSettings{Mode: "verify-full"},
			expConnStr:  `user='u\'\\ser' password='password' host='host' dbname='d\'\\atabase' sslmode='verify-full'`,
		},
		{
			desc:        "Custom TLS mode disabled",
			host:        "host",
			user:        "user",
			password:    "password",
			database:    "database",
			tlsSettings: tlsSettings{Mode: "disable"},
			expConnStr:  "user='user' password='password' host='host' dbname='database' sslmode='disable'",
		},
		{
			desc:     "Custom TLS mode verify-full with certificate files",
			host:     "host",
			user:     "user",
			password: "password",
			database: "database",
			tlsSettings: tlsSettings{
				Mode:         "verify-full",
				RootCertFile: "i/am/coding/ca.crt",
				CertFile:     "i/am/coding/client.crt",
				CertKeyFile:  "i/am/coding/client.key",
			},
			expConnStr: "user='user' password='password' host='host' dbname='database' sslmode='verify-full' " +
				"sslrootcert='i/am/coding/ca.crt' sslcert='i/am/coding/client.crt' sslkey='i/am/coding/client.key'",
		},
	}
	for _, tt := range testCases {
		t.Run(tt.desc, func(t *testing.T) {
			svc := Service{
				tlsManager: &tlsTestManager{settings: tt.tlsSettings},
			}

			ds := sqleng.DataSourceInfo{
				URL:                     tt.host,
				User:                    tt.user,
				DecryptedSecureJSONData: map[string]string{"password": tt.password},
				Database:                tt.database,
				UID:                     tt.uid,
			}

			connStr, err := svc.generateConnectionString(ds)

			if tt.expErr == "" {
				require.NoError(t, err, tt.desc)
				assert.Equal(t, tt.expConnStr, connStr)
			} else {
				require.Error(t, err, tt.desc)
				assert.True(t, strings.HasPrefix(err.Error(), tt.expErr),
					fmt.Sprintf("%s: %q doesn't start with %q", tt.desc, err, tt.expErr))
			}
		})
	}
}

// To run this test, set runPostgresTests=true
// Or from the commandline: GRAFANA_TEST_DB=postgres go test -tags=integration -v ./pkg/tsdb/postgres
// The tests require a PostgreSQL db named grafanadstest and a user/password grafanatest/grafanatest!
// Use the docker/blocks/postgres_tests/docker-compose.yaml to spin up a
// preconfigured Postgres server suitable for running these tests.
// There is also a datasource and dashboard provisioned by devenv scripts that you can
// use to verify that the generated data are visualized as expected, see
// devenv/README.md for setup instructions.
func TestIntegrationPostgres(t *testing.T) {
	// change to true to run the PostgreSQL tests
	const runPostgresTests = false

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
	sqleng.Interpolate = func(query backend.DataQuery, timeRange backend.TimeRange, timeInterval string, sql string) (string, error) {
		return sql, nil
	}

	cfg := setting.NewCfg()
	cfg.DataPath = t.TempDir()

	jsonData := sqleng.JsonData{
		MaxOpenConns:        0,
		MaxIdleConns:        2,
		ConnMaxLifetime:     14400,
		Timescaledb:         false,
		ConfigurationMethod: "file-path",
	}

	dsInfo := sqleng.DataSourceInfo{
		JsonData:                jsonData,
		DecryptedSecureJSONData: map[string]string{},
	}

	config := sqleng.DataPluginConfiguration{
		DriverName:        "postgres",
		ConnectionString:  "",
		DSInfo:            dsInfo,
		MetricColumnTypes: []string{"UNKNOWN", "TEXT", "VARCHAR", "CHAR"},
		RowLimit:          1000000,
	}

	queryResultTransformer := postgresQueryResultTransformer{
		log: logger,
	}

	exe, err := sqleng.NewQueryDataHandler(config, &queryResultTransformer, newPostgresMacroEngine(dsInfo.JsonData.Timescaledb),
		logger)

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
				time date,
				c15_interval interval,
				c16_smallint smallint
			);
		`
		_, err := sess.Exec(sql)
		require.NoError(t, err)

		sql = `
			INSERT INTO postgres_types VALUES(
				1,2,3,
				4.5,6.7,1.1,1.2,
				'char10','varchar10','text',

				now(),now(),now(),now(),now(),now(),'15m'::interval,
				null
			);
		`
		_, err = sess.Exec(sql)
		require.NoError(t, err)

		t.Run("When doing a table query should map Postgres column types to Go types", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT * FROM postgres_types",
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
			require.Len(t, frames[0].Fields, 18)

			require.Equal(t, int16(1), *frames[0].Fields[0].At(0).(*int16))
			require.Equal(t, int32(2), *frames[0].Fields[1].At(0).(*int32))
			require.Equal(t, int64(3), *frames[0].Fields[2].At(0).(*int64))

			require.Equal(t, float64(4.5), *frames[0].Fields[3].At(0).(*float64))
			require.Equal(t, float64(6.7), *frames[0].Fields[4].At(0).(*float64))
			require.Equal(t, float64(1.1), *frames[0].Fields[5].At(0).(*float64))
			require.Equal(t, float64(1.2), *frames[0].Fields[6].At(0).(*float64))

			require.Equal(t, "char10    ", *frames[0].Fields[7].At(0).(*string))
			require.Equal(t, "varchar10", *frames[0].Fields[8].At(0).(*string))
			require.Equal(t, "text", *frames[0].Fields[9].At(0).(*string))

			_, ok := frames[0].Fields[10].At(0).(*time.Time)
			require.True(t, ok)
			_, ok = frames[0].Fields[11].At(0).(*time.Time)
			require.True(t, ok)
			_, ok = frames[0].Fields[12].At(0).(*time.Time)
			require.True(t, ok)
			_, ok = frames[0].Fields[13].At(0).(*time.Time)
			require.True(t, ok)
			_, ok = frames[0].Fields[14].At(0).(*time.Time)
			require.True(t, ok)
			_, ok = frames[0].Fields[15].At(0).(*time.Time)
			require.True(t, ok)
			require.Equal(t, "00:15:00", *frames[0].Fields[16].At(0).(*string))
			require.Nil(t, frames[0].Fields[17].At(0))
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
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
								"rawSql": "SELECT $__timeGroup(time, '5m') AS time, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
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
			require.Equal(t, 4, frames[0].Fields[0].Len())

			// without fill this should result in 4 buckets

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

		t.Run("When doing a metric query using timeGroup and $__interval", func(t *testing.T) {
			mockInterpolate := sqleng.Interpolate
			sqleng.Interpolate = origInterpolate
			t.Cleanup(func() {
				sqleng.Interpolate = mockInterpolate
			})

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
			frames := queryResult.Frames

			require.NoError(t, queryResult.Error)
			require.Equal(t,
				"SELECT floor(extract(epoch from time)/60)*60 AS time, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
				frames[0].Meta.ExecutedQueryString)
		})

		t.Run("When doing a metric query using timeGroup with NULL fill enabled", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeGroup(time, '5m', NULL) AS time, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
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
				require.True(t, aTime.Equal(dt))
				dt = dt.Add(5 * time.Minute)
			}

			// check for NULL values inserted by fill
			require.Nil(t, frames[0].Fields[1].At(2))
			require.Nil(t, frames[0].Fields[1].At(3))

			// adjust for 10 minute gap between first and second set of points
			dt = dt.Add(10 * time.Minute)
			for i := 4; i < 6; i++ {
				aValue := *frames[0].Fields[1].At(i).(*float64)
				aTime := *frames[0].Fields[0].At(i).(*time.Time)
				require.Equal(t, float64(20), aValue)
				require.True(t, aTime.Equal(dt))
				dt = dt.Add(5 * time.Minute)
			}

			// check for NULL values inserted by fill
			require.Nil(t, frames[0].Fields[1].At(6))
		})

		t.Run("When doing a metric query using timeGroup with value fill enabled", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeGroup(time, '5m', 1.5) AS time, avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
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
			require.Equal(t, 1.5, *frames[0].Fields[1].At(3).(*float64))
		})
	})

	t.Run("Given a table with one data point", func(t *testing.T) {
		type metric struct {
			Time  time.Time
			Value int64
		}

		startTime := time.Now().UTC().Add(-time.Minute * 5)
		series := []*metric{
			{
				Time:  startTime,
				Value: 33,
			},
		}

		_, err = sess.InsertMulti(series)
		require.NoError(t, err)

		t.Run("querying with time group with default value", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "WITH data AS (SELECT now()-'3m'::interval AS ts, 42 AS n) SELECT $__timeGroup(ts, '1m', 0), n FROM data",
							"format": "time_series"
						}`),
						RefID: "A",
						TimeRange: backend.TimeRange{
							From: startTime,
							To:   startTime.Add(5 * time.Minute),
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
			require.Equal(t, "Time", frames[0].Fields[0].Name)
			require.Equal(t, "n", frames[0].Fields[1].Name)
			require.Equal(t, float64(0), *frames[0].Fields[1].At(0).(*float64))
			require.Equal(t, float64(0), *frames[0].Fields[1].At(1).(*float64))
			require.Equal(t, float64(42), *frames[0].Fields[1].At(2).(*float64))
			require.Equal(t, float64(0), *frames[0].Fields[1].At(3).(*float64))
			require.Equal(t, float64(0), *frames[0].Fields[1].At(4).(*float64))
			require.Equal(t, float64(0), *frames[0].Fields[1].At(5).(*float64))
		})
	})

	t.Run("When doing a metric query using timeGroup with previous fill enabled", func(t *testing.T) {
		query := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					JSON: []byte(`{
						"rawSql": "SELECT $__timeGroup(time, '5m', previous), avg(value) as value FROM metric GROUP BY 1 ORDER BY 1",
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
		require.Equal(t, float64(15.0), *frames[0].Fields[1].At(2).(*float64))
		require.Equal(t, float64(15.0), *frames[0].Fields[1].At(3).(*float64))
		require.Equal(t, float64(20.0), *frames[0].Fields[1].At(6).(*float64))
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

		if exists, err := sess.IsTableExist(metric_values{}); err != nil || exists {
			require.NoError(t, err)
			err := sess.DropTable(metric_values{})
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
			"When doing a metric query using epoch (int64) as time column and value column (int64) should return metric with time in time.Time",
			func(t *testing.T) {
				query := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							JSON: []byte(`{
								"rawSql": "SELECT \"timeInt64\" as time, \"timeInt64\" FROM metric_values ORDER BY time LIMIT 1",
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

		t.Run("When doing a metric query using epoch (int64 nullable) as time column and value column (int64 nullable,) should return metric with time in time.Time",
			func(t *testing.T) {
				query := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							JSON: []byte(`{
								"rawSql": "SELECT \"timeInt64Nullable\" as time, \"timeInt64Nullable\" FROM metric_values ORDER BY time LIMIT 1",
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

		t.Run("When doing a metric query using epoch (float64) as time column and value column (float64), should return metric with time in time.Time",
			func(t *testing.T) {
				query := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							JSON: []byte(`{
								"rawSql": "SELECT \"timeFloat64\" as time, \"timeFloat64\" FROM metric_values ORDER BY time LIMIT 1",
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

		t.Run("When doing a metric query using epoch (float64 nullable) as time column and value column (float64 nullable), should return metric with time in time.Time",
			func(t *testing.T) {
				query := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							JSON: []byte(`{
								"rawSql": "SELECT \"timeFloat64Nullable\" as time, \"timeFloat64Nullable\" FROM metric_values ORDER BY time LIMIT 1",
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
				require.True(t, tInitial.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
			})

		t.Run("When doing a metric query using epoch (int32) as time column and value column (int32), should return metric with time in time.Time",
			func(t *testing.T) {
				query := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							JSON: []byte(`{
								"rawSql": "SELECT \"timeInt32\" as time, \"timeInt32\" FROM metric_values ORDER BY time LIMIT 1",
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
				require.True(t, tInitial.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
			})

		t.Run("When doing a metric query using epoch (int32 nullable) as time column and value column (int32 nullable), should return metric with time in time.Time",
			func(t *testing.T) {
				query := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							JSON: []byte(`{
								"rawSql": "SELECT \"timeInt32Nullable\" as time, \"timeInt32Nullable\" FROM metric_values ORDER BY time LIMIT 1",
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
				require.True(t, tInitial.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
			})

		t.Run("When doing a metric query using epoch (float32) as time column and value column (float32), should return metric with time in time.Time",
			func(t *testing.T) {
				query := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							JSON: []byte(`{
								"rawSql": "SELECT \"timeFloat32\" as time, \"timeFloat32\" FROM metric_values ORDER BY time LIMIT 1",
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
				aTime := time.Unix(0, int64(float64(float32(tInitial.Unix()))*1e3)*int64(time.Millisecond))
				require.True(t, aTime.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
			})

		t.Run("When doing a metric query using epoch (float32 nullable) as time column and value column (float32 nullable), should return metric with time in time.Time",
			func(t *testing.T) {
				query := &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							JSON: []byte(`{
								"rawSql": "SELECT \"timeFloat32Nullable\" as time, \"timeFloat32Nullable\" FROM metric_values ORDER BY time LIMIT 1",
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
				aTime := time.Unix(0, int64(float64(float32(tInitial.Unix()))*1e3)*int64(time.Millisecond))
				require.True(t, aTime.Equal(*frames[0].Fields[0].At(0).(*time.Time)))
			})

		t.Run("When doing a metric query grouping by time and select metric column should return correct series", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeEpoch(time), measurement || ' - value one' as metric, \"valueOne\" FROM metric_values ORDER BY 1",
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
			require.Equal(t, 3, len(frames[0].Fields))
			require.Equal(t, "Metric A - value one", frames[0].Fields[1].Name)
			require.Equal(t, "Metric B - value one", frames[0].Fields[2].Name)
		})

		t.Run("When doing a metric query with metric column and multiple value columns", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeEpoch(time), measurement as metric, \"valueOne\", \"valueTwo\" FROM metric_values ORDER BY 1",
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

		t.Run("When doing a metric query grouping by time should return correct series", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT $__timeEpoch(time), \"valueOne\", \"valueTwo\" FROM metric_values ORDER BY 1",
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
			require.Equal(t, 3, len(frames[0].Fields))
			require.Equal(t, "valueOne", frames[0].Fields[1].Name)
			require.Equal(t, "valueTwo", frames[0].Fields[2].Name)
		})

		t.Run("When doing a query with timeFrom,timeTo,unixEpochFrom,unixEpochTo macros", func(t *testing.T) {
			fakeInterpolate := sqleng.Interpolate
			t.Cleanup(func() {
				sqleng.Interpolate = fakeInterpolate
			})
			sqleng.Interpolate = origInterpolate

			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT time FROM metric_values WHERE time > $__timeFrom() OR time < $__timeFrom() OR 1 < $__unixEpochFrom() OR $__unixEpochTo() > 1 ORDER BY 1",
							"format": "time_series"
						}`),
						RefID: "A",
						TimeRange: backend.TimeRange{
							From: fromStart.Add(-5 * time.Minute),
							To:   fromStart,
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
			require.Equal(t,
				"SELECT time FROM metric_values WHERE time > '2018-03-15T12:55:00Z' OR time < '2018-03-15T12:55:00Z' OR 1 < 1521118500 OR 1521118800 > 1 ORDER BY 1",
				frames[0].Meta.ExecutedQueryString)
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
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT \"time_sec\" as time, description as text, tags FROM event WHERE $__unixEpochFilter(time_sec) AND tags='deploy' ORDER BY 1 ASC",
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
		})

		t.Run("When doing an annotation query of ticket events should return expected result", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT \"time_sec\" as time, description as text, tags FROM event WHERE $__unixEpochFilter(time_sec) AND tags='ticket' ORDER BY 1 ASC",
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
			require.Equal(t, 1, len(frames))
			require.Equal(t, 3, len(frames[0].Fields))
		})

		t.Run("When doing an annotation query with a time column in datetime format", func(t *testing.T) {
			dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)
			dtFormat := "2006-01-02 15:04:05.999999999"

			queryjson := fmt.Sprintf("{\"rawSql\": \"SELECT CAST('%s' AS TIMESTAMP) as time, 'message' as text, 'tag1,tag2' as tags\", \"format\": \"table\" }", dt.Format(dtFormat))
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON:  []byte(queryjson),
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
			require.Equal(t, 3, len(frames[0].Fields))

			// Should be in time.Time
			require.Equal(t, dt.Unix(), (*frames[0].Fields[0].At(0).(*time.Time)).Unix())
		})

		t.Run("When doing an annotation query with a time column in epoch second format should return time.Time", func(t *testing.T) {
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

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, 3, len(frames[0].Fields))

			// Should be in time.Time
			require.Equal(t, dt.Unix(), (*frames[0].Fields[0].At(0).(*time.Time)).Unix())
		})

		t.Run("When doing an annotation query with a time column in epoch second format (t *testing.Tint) should return time.Time", func(t *testing.T) {
			dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)
			queryjson := fmt.Sprintf("{\"rawSql\": \"SELECT cast(%d as bigint) as time, 'message' as text, 'tag1,tag2' as tags\", \"format\": \"table\"}", dt.Unix())
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON:  []byte(queryjson),
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
			require.Equal(t, 3, len(frames[0].Fields))

			// Should be in time.Time
			require.Equal(t, dt.Unix(), (*frames[0].Fields[0].At(0).(*time.Time)).Unix())
		})

		t.Run("When doing an annotation query with a time column in epoch millisecond format should return time.Time", func(t *testing.T) {
			dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)

			queryjson := fmt.Sprintf("{\"rawSql\":\"SELECT %d as time, 'message' as text, 'tag1,tag2' as tags\", \"format\": \"table\"}", dt.Unix()*1000)
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON:  []byte(queryjson),
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
			require.Equal(t, 3, len(frames[0].Fields))

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

			resp, err := exe.QueryData(context.Background(), query)
			require.NoError(t, err)
			queryResult := resp.Responses["A"]
			require.NoError(t, queryResult.Error)

			frames := queryResult.Frames
			require.Equal(t, 1, len(frames))
			require.Equal(t, 3, len(frames[0].Fields))

			// Should be in time.Time
			require.Nil(t, frames[0].Fields[0].At(0))
		})

		t.Run("When doing an annotation query with a time column holding a timestamp null value should return nil", func(t *testing.T) {
			query := &backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						JSON: []byte(`{
							"rawSql": "SELECT cast(null as timestamp) as time, 'message' as text, 'tag1,tag2' as tags",
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
			require.Equal(t, 3, len(frames[0].Fields))

			// Should be in time.Time
			assert.Nil(t, frames[0].Fields[0].At(0))
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
				DriverName:        "postgres",
				ConnectionString:  "",
				DSInfo:            dsInfo,
				MetricColumnTypes: []string{"UNKNOWN", "TEXT", "VARCHAR", "CHAR"},
				RowLimit:          1,
			}

			queryResultTransformer := postgresQueryResultTransformer{
				log: logger,
			}

			handler, err := sqleng.NewQueryDataHandler(config, &queryResultTransformer, newPostgresMacroEngine(false), logger)
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

			t.Run("When doing a time series query that returns 2 rows should limit the result to 1 row", func(t *testing.T) {
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
}

func InitPostgresTestDB(t *testing.T) *xorm.Engine {
	testDB := sqlutil.PostgresTestDB()
	x, err := xorm.NewEngine(testDB.DriverName, strings.Replace(testDB.ConnStr, "dbname=grafanatest",
		"dbname=grafanadstest", 1))
	require.NoError(t, err, "Failed to init postgres DB")

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

type tlsTestManager struct {
	settings tlsSettings
}

func (m *tlsTestManager) getTLSSettings(dsInfo sqleng.DataSourceInfo) (tlsSettings, error) {
	return m.settings, nil
}
