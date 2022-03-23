package loki

import (
	"bytes"
	"context"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

// NOTE: in these tests there several different json-content-types.
// different versions of Loki use different json-content-types.
// this is probably not important when we will parse them,
// but i wanted to test for all of them, to be sure.

func TestSuccessResponse(t *testing.T) {
	matrixQuery := lokiQuery{Expr: "up(ALERTS)", Step: time.Second * 42, QueryType: QueryTypeRange}
	vectorQuery := lokiQuery{Expr: "query1", QueryType: QueryTypeInstant}
	streamsQuery := lokiQuery{Expr: "query1", QueryType: QueryTypeRange}

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

		{name: "parse a simple vector response", filepath: "vector_simple", query: vectorQuery},
		{name: "parse a vector response with special values", filepath: "vector_special_values", query: vectorQuery},

		{name: "parse a simple streams response", filepath: "streams_simple", query: streamsQuery},
	}

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			responseFileName := filepath.Join("testdata", test.filepath+".json")
			goldenFileName := filepath.Join("testdata", test.filepath+".golden.txt")

			bytes, err := os.ReadFile(responseFileName)
			require.NoError(t, err)

			frames, err := runQuery(context.Background(), makeMockedAPI(200, "application/json", bytes), &test.query)
			require.NoError(t, err)

			dr := &backend.DataResponse{
				Frames: frames,
				Error:  err,
			}

			err = experimental.CheckGoldenDataResponse(goldenFileName, dr, true)
			require.NoError(t, err)
		})
	}
}

func TestErrorResponse(t *testing.T) {
	// NOTE: when there is an error-response, it comes with
	// HTTP code 400, and the format seems to change between versions:
	// 2.3.x: content-type=text/plain, content is plaintext
	// 2.4.x: content-type=application/json, content is plaintext: https://github.com/grafana/loki/issues/4844
	// main-branch: content-type=application/json, content is JSON
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
			name:         "parse a non-json error body with json content type (loki 2.4.0,2.4.1,2.4.2)",
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
			frames, err := runQuery(context.Background(), makeMockedAPI(400, test.contentType, test.body), &lokiQuery{QueryType: QueryTypeRange})

			require.Len(t, frames, 0)
			require.Error(t, err)
			require.EqualError(t, err, test.errorMessage)
		})
	}
}

type mockedRoundTripper struct {
	statusCode    int
	responseBytes []byte
	contentType   string
}

func (mockedRT *mockedRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	header := http.Header{}
	header.Add("Content-Type", mockedRT.contentType)
	return &http.Response{
		StatusCode: mockedRT.statusCode,
		Header:     header,
		Body:       ioutil.NopCloser(bytes.NewReader(mockedRT.responseBytes)),
	}, nil
}

func makeMockedAPI(statusCode int, contentType string, responseBytes []byte) *LokiAPI {
	client := http.Client{
		Transport: &mockedRoundTripper{statusCode: statusCode, contentType: contentType, responseBytes: responseBytes},
	}

	return newLokiAPI(&client, "http://localhost:9999", log.New("test"))
}
