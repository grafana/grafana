package loki

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"

	"github.com/stretchr/testify/require"
)

// NOTE: in these tests there several different json-content-types.
// different versions of Loki use different json-content-types.
// this is probably not important when we will parse them,
// but i wanted to test for all of them, to be sure.

func TestSuccessResponse(t *testing.T) {
	matrixQuery := lokiQuery{Expr: "up(ALERTS)", Step: time.Second * 42, QueryType: QueryTypeRange, Direction: DirectionBackward, RefID: "mq"}
	vectorQuery := lokiQuery{Expr: "query1", QueryType: QueryTypeInstant, Direction: DirectionBackward, RefID: "vq"}
	streamsQuery := lokiQuery{Expr: "query1", QueryType: QueryTypeRange, Direction: DirectionBackward, RefID: "sq"}

	tt := []struct {
		name     string
		filepath string
		query    lokiQuery
	}{
		{name: "parse a simple matrix response", filepath: "matrix_simple", query: matrixQuery},
		{name: "parse a matrix response with a time-gap in the middle", filepath: "matrix_gap", query: matrixQuery},
		// you can produce NaN by having a metric query and add ` / 0` to the end
		{name: "parse a matrix response with NaN", filepath: "matrix_nan", query: matrixQuery},
		// you can produce Infinity by using `quantile_over_time(42,` (value larger than 1)
		{name: "parse a matrix response with Infinity", filepath: "matrix_inf", query: matrixQuery},
		{name: "parse a matrix response with very small step value", filepath: "matrix_small_step", query: matrixQuery},

		// Prometheus handles the `__name__` label in a special way, but Loki should not.
		{name: "parse a matrix response with __name__ label normally", filepath: "matrix_name", query: matrixQuery},

		// loki adds stats to matrix-responses too
		{name: "parse a matrix response with stats", filepath: "matrix_with_stats", query: matrixQuery},

		{name: "parse a simple vector response", filepath: "vector_simple", query: vectorQuery},
		{name: "parse a vector response with special values", filepath: "vector_special_values", query: vectorQuery},

		{name: "parse a simple streams response", filepath: "streams_simple", query: streamsQuery},

		{name: "parse a streams response with parse errors", filepath: "streams_parse_errors", query: streamsQuery},

		{name: "parse an empty response", filepath: "empty", query: matrixQuery},

		{name: "parse structured metadata", filepath: "streams_structured_metadata", query: streamsQuery},
		{name: "parse structured metadata different labels each log line", filepath: "streams_structured_metadata_2", query: streamsQuery},

		{name: "parse warnings", filepath: "warning", query: streamsQuery},
	}

	runTest := func(folder string, path string, query lokiQuery, responseOpts ResponseOpts) {
		responseFileName := filepath.Join(folder, path+".json")
		goldenFileName := path + ".golden"

		//nolint:gosec
		bytes, err := os.ReadFile(responseFileName)
		require.NoError(t, err)

		dr, err := runQuery(context.Background(), makeMockedAPI(http.StatusOK, "application/json", bytes, nil), &query, responseOpts, backend.NewLoggerWith("logger", "test"))
		require.NoError(t, err)

		experimental.CheckGoldenJSONResponse(t, folder, goldenFileName, dr, false)
	}

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			runTest("test_non_dataplane", test.filepath, test.query, ResponseOpts{logsDataplane: false})
			runTest("testdata_dataplane", test.filepath, test.query, ResponseOpts{logsDataplane: true})
		})
	}
}

func TestErrorResponse(t *testing.T) {
	// NOTE: when there is an error-response, it comes with
	// HTTP code 400, and the format seems to change between versions:
	// 2.3.x: content-type=text/plain, content is plaintext
	// 2.4.x+: content-type=application/json, content is plaintext: https://github.com/grafana/loki/issues/4844
	// we should always be able to to return some kind of error message
	tt := []struct {
		name         string
		body         []byte
		contentType  string
		errorMessage string
	}{
		{
			name: "parse an error response in JSON",
			body: []byte(`
			{
				"status": "error",
				"code": 400,
				"message": "parse error at line 1, col 8: something is wrong"
			}`),
			contentType:  "application/json; charset=utf-8",
			errorMessage: "parse error at line 1, col 8: something is wrong",
		},
		{
			name:         "parse a non-json error body with json content type",
			body:         []byte("parse error at line 1, col 8: something is wrong"),
			contentType:  "application/json; charset=UTF-8",
			errorMessage: "parse error at line 1, col 8: something is wrong",
		},
		{
			name:         "parse an error response in plain text",
			body:         []byte("parse error at line 1, col 8: something is wrong"),
			contentType:  "text/plain; charset=utf-8",
			errorMessage: "parse error at line 1, col 8: something is wrong",
		},
		{
			name:         "parse an error response that is broken JSON",
			body:         []byte(`{"message":"error message but the JSON is not finished`),
			contentType:  "text/plain; charset=utf-8",
			errorMessage: `{"message":"error message but the JSON is not finished`,
		},
	}

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			dr, err := runQuery(context.Background(), makeMockedAPI(400, test.contentType, test.body, nil), &lokiQuery{QueryType: QueryTypeRange, Direction: DirectionBackward}, ResponseOpts{}, backend.NewLoggerWith("logger", "test"))
			require.NoError(t, err)
			require.Len(t, dr.Frames, 0)
			require.Equal(t, dr.Error.Error(), test.errorMessage)
			require.Equal(t, dr.ErrorSource, backend.ErrorSourceDownstream)
		})
	}
}

func TestErrorsFromResponseCodes(t *testing.T) {
	tt := []struct {
		name        string
		statusCode  int
		errorSource backend.ErrorSource
	}{
		{
			name:        "parse response with status code 400 into correct error",
			statusCode:  400,
			errorSource: backend.ErrorSourceDownstream,
		},
		{
			name:        "parse response with status code 406 into correct error",
			statusCode:  406,
			errorSource: backend.ErrorSourcePlugin,
		},
		{
			name:        "parse response with status code 413 into correct error",
			statusCode:  413,
			errorSource: backend.ErrorSourcePlugin,
		},
		{
			name:        "parse response with status code 500 into correct error",
			statusCode:  500,
			errorSource: backend.ErrorSourceDownstream,
		},
		{
			name:        "parse response with status code 501 into correct error",
			statusCode:  501,
			errorSource: backend.ErrorSourcePlugin,
		},
	}

	errorString := "parse error at line 1, col 8: something is wrong"
	contentType := "application/json; charset=UTF-8"

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			dr, _ := runQuery(context.Background(), makeMockedAPI(test.statusCode, contentType, []byte(errorString), nil), &lokiQuery{QueryType: QueryTypeRange, Direction: DirectionBackward}, ResponseOpts{}, backend.NewLoggerWith("logger", "test"))
			require.Len(t, dr.Frames, 0)
			require.Equal(t, dr.Error.Error(), errorString)
			require.Equal(t, dr.ErrorSource, test.errorSource)
		})
	}
}
