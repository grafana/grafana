package mysql

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/mysql/sqleng"

	_ "github.com/go-sql-driver/mysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var updateGoldenFiles = false

// These tests require a real mysql database:
// - make devenv sources=potgres_tests
// - either set the env variable GRAFANA_TEST_DB = mysql
//   - or set `forceRun := true` below
//
// The tests require a MySQL db named grafanadstest and a user/password grafanatest/grafanatest!
// Use the docker/blocks/mysql_tests/docker-compose.yaml to spin up a
// preconfigured MySQL server suitable for running these tests.
func TestIntegrationMySQLSnapshots(t *testing.T) {
	testutil.
		// the logic in this function is copied from mysql_tests.go
		SkipIntegrationTestInShortMode(t)

	shouldRunTest := func() bool {
		if testing.Short() {
			return false
		}

		testDbName, present := os.LookupEnv("GRAFANA_TEST_DB")

		if present && testDbName == "mysql" {
			return true
		}

		return false
	}

	if !shouldRunTest() {
		t.Skip()
	}

	sqlQueryCommentRe := regexp.MustCompile(`^-- (.+)\n`)

	readSqlFile := func(path string) (string, []string) {
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

		// mysql is unable to send multiple queries in a single `Query()`,
		// so we split the queries. we split by an "empty new line"
		sqls := strings.Split(sql, "\n\n")

		return rawSQL, sqls
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
		{format: "table", name: "no_rows"},
		{format: "table", name: "types_numeric"},
		{format: "table", name: "types_char"},
		{format: "table", name: "types_datetime"},
		{format: "table", name: "types_other"},
		{format: "table", name: "timestamp_convert_bigint"},
		{format: "table", name: "timestamp_convert_integer"},
		{format: "table", name: "timestamp_convert_float"},
		{format: "table", name: "timestamp_convert_double"},
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

			host := os.Getenv("MYSQL_HOST")
			if host == "" {
				host = "localhost"
			}
			port := os.Getenv("MYSQL_PORT")
			if port == "" {
				port = "3306"
			}
			cnnStr := fmt.Sprintf("grafana:password@tcp(%s:%s)/grafana_ds_tests?collation=utf8mb4_unicode_ci&sql_mode='ANSI_QUOTES'&parseTime=true&loc=UTC", host, port)

			dsInfo := sqleng.DataSourceInfo{
				JsonData: sqleng.JsonData{
					MaxOpenConns:    0,
					MaxIdleConns:    2,
					ConnMaxLifetime: 14400,
				},
			}

			db, err := sql.Open("mysql", cnnStr)

			if err != nil {
				t.Fatalf("Failed to init mysql db %v", err)
			}

			db.SetMaxOpenConns(dsInfo.JsonData.MaxOpenConns)
			db.SetMaxIdleConns(dsInfo.JsonData.MaxIdleConns)
			db.SetConnMaxLifetime(time.Duration(dsInfo.JsonData.ConnMaxLifetime))

			rowTransformer := mysqlQueryResultTransformer{}

			logger := backend.NewLoggerWith("logger", "mysql.test")

			config := sqleng.DataPluginConfiguration{
				DSInfo:            dsInfo,
				TimeColumnNames:   []string{"time", "time_sec"},
				MetricColumnTypes: []string{"CHAR", "VARCHAR", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT"},
				RowLimit:          1000000,
			}

			handler, err := sqleng.NewQueryDataHandler("", db, config, &rowTransformer, newMysqlMacroEngine(logger, ""), logger)

			require.NoError(t, err)

			t.Cleanup((func() {
				_, err := db.Exec("DROP TABLE IF EXISTS tbl")
				require.NoError(t, err)
				err = db.Close()
				require.NoError(t, err)
			}))

			require.NoError(t, err)

			sqlFilePath := filepath.Join("testdata", test.format, test.name+".sql")
			goldenFileName := filepath.Join(test.format, test.name+".golden")

			rawSQL, sqls := readSqlFile(sqlFilePath)

			_, err = db.Exec("DROP TABLE IF EXISTS tbl")
			require.NoError(t, err)

			for _, sql := range sqls {
				_, err = db.Exec(sql)
				require.NoError(t, err)
			}

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
