package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/sqleng"
)

var updateGoldenFiles = false

// These tests require a real postgres database:
// - make devenv sources=potgres_tests
// - either set the env variable GRAFANA_TEST_DB = postgres
//   - or set `forceRun := true` below
//
// The tests require a PostgreSQL db named grafanadstest and a user/password grafanatest/grafanatest!
// Use the docker/blocks/postgres_tests/docker-compose.yaml to spin up a
// preconfigured Postgres server suitable for running these tests.
func TestIntegrationPostgresSnapshots(t *testing.T) {
	// the logic in this function is copied from postgres_tests.go
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	shouldRunTest := func() bool {
		if testing.Short() {
			return false
		}

		testDbName, present := os.LookupEnv("GRAFANA_TEST_DB")

		if present && testDbName == "postgres" {
			return true
		}

		return false
	}

	if !shouldRunTest() {
		t.Skip()
	}

	getCnnStr := func() string {
		host := os.Getenv("POSTGRES_HOST")
		if host == "" {
			host = "localhost"
		}
		port := os.Getenv("POSTGRES_PORT")
		if port == "" {
			port = "5432"
		}

		return fmt.Sprintf("user=grafanatest password=grafanatest host=%s port=%s dbname=grafanadstest sslmode=disable",
			host, port)
	}

	sqlQueryCommentRe := regexp.MustCompile(`^-- (.+)\n`)

	readSqlFile := func(path string) (string, string) {
		// the file-path is not coming from the outside,
		// it is hardcoded in this file.
		//nolint:gosec
		sqlBytes, err := os.ReadFile(path)
		require.NoError(t, err)

		sql := string(sqlBytes)

		// first line of the file contains the sql query to run, commented out
		match := sqlQueryCommentRe.FindStringSubmatch(sql)
		require.Len(t, match, 2)

		rawSQL := strings.TrimSpace(match[1])

		return rawSQL, sql
	}

	makeQuery := func(rawSQL string, format string) backend.QueryDataRequest {
		queryData := map[string]string{
			"rawSql": rawSQL,
			"format": format,
		}

		queryBytes, err := json.Marshal(queryData)
		require.NoError(t, err)

		return backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					JSON:  queryBytes,
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: time.Date(2023, 12, 24, 14, 15, 22, 123456, time.UTC),
						To:   time.Date(2023, 12, 24, 14, 45, 13, 876543, time.UTC),
					},
				},
			},
		}
	}

	tt := []struct {
		name   string
		format string
	}{
		{format: "time_series", name: "simple"},
		{format: "time_series", name: "no_rows_long"},
		{format: "time_series", name: "no_rows_wide"},
		{format: "time_series", name: "7x_compat_metric_label"},
		{format: "time_series", name: "convert_to_float64"},
		{format: "time_series", name: "convert_to_float64_not"},
		{format: "time_series", name: "fill_null"},
		{format: "time_series", name: "fill_previous"},
		{format: "time_series", name: "fill_value"},
		{format: "time_series", name: "fill_value_wide"},
		{format: "table", name: "simple"},
		{format: "table", name: "multi_stat1"},
		{format: "table", name: "multi_stat2"},
		{format: "table", name: "no_rows"},
		{format: "table", name: "types_numeric"},
		{format: "table", name: "types_char"},
		{format: "table", name: "types_datetime"},
		{format: "table", name: "types_other"},
		{format: "table", name: "timestamp_convert_bigint"},
		{format: "table", name: "timestamp_convert_integer"},
		{format: "table", name: "timestamp_convert_real"},
		{format: "table", name: "timestamp_convert_double"},
		{format: "table", name: "time_group_compat_case1"},
		{format: "table", name: "time_group_compat_case2"},
	}

	for _, test := range tt {
		require.True(t, test.format == "table" || test.format == "time_series")
		t.Run(test.name, func(t *testing.T) {
			origInterpolate := sqleng.Interpolate
			t.Cleanup(func() {
				sqleng.Interpolate = origInterpolate
			})

			sqleng.Interpolate = func(query backend.DataQuery, timeRange backend.TimeRange, timeInterval string, sql string) string {
				return sql
			}

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

			logger := log.New()

			cnnstr := getCnnStr()

			db, handler, err := newPostgres(context.Background(), "error", 10000, dsInfo, cnnstr, logger, backend.DataSourceInstanceSettings{})

			t.Cleanup((func() {
				_, err := db.Exec("DROP TABLE tbl")
				require.NoError(t, err)
				err = db.Close()
				require.NoError(t, err)
			}))

			require.NoError(t, err)

			sqlFilePath := filepath.Join("testdata", test.format, test.name+".sql")
			goldenFileName := filepath.Join(test.format, test.name+".golden")

			rawSQL, sql := readSqlFile(sqlFilePath)

			_, err = db.Exec(sql)
			require.NoError(t, err)

			query := makeQuery(rawSQL, test.format)

			result, err := handler.QueryData(context.Background(), &query)
			require.Len(t, result.Responses, 1)
			response, found := result.Responses["A"]
			require.True(t, found)
			require.NoError(t, err)
			experimental.CheckGoldenJSONResponse(t, "testdata", goldenFileName, &response, updateGoldenFiles)
		})
	}
}
