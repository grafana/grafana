package loki

import (
	"bytes"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/loki/pkg/logcli/client"
	"github.com/stretchr/testify/require"
)

// NOTE: in these tests there several different json-content-types.
// different versions of Loki use different json-content-types.
// this is probably not important when we will parse them,
// but i wanted to test for all of them, to be sure.

func TestSuccessResponse(t *testing.T) {
	tt := []struct {
		name     string
		filepath string
	}{
		{name: "parse a simple matrix response", filepath: "matrix_simple"},
		{name: "parse a matrix response with a time-gap in the middle", filepath: "matrix_gap"},
		// you can produce NaN by having a metric query and add ` / 0` to the end
		{name: "parse a matrix response with NaN", filepath: "matrix_nan"},
		// you can produce Infinity by using `quantile_over_time(42,` (value larger than 1)
		{name: "parse a matrix response with Infinity", filepath: "matrix_inf"},
		{name: "parse a matrix response with very small step value", filepath: "matrix_small_step"},
	}

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			responseFileName := filepath.Join("testdata", test.filepath+".json")
			goldenFileName := filepath.Join("testdata", test.filepath+".golden.txt")

			bytes, err := os.ReadFile(responseFileName)
			require.NoError(t, err)

			frames, err := runQuery(makeMockedClient(200, "application/json", bytes), &lokiQuery{})
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
	// 2.4.0: content-type=application/json, content is plaintext !!!
	// 2.4.1: same as 2.4.0
	// 2.4.2: same as 2.4.0 (2.4.2 is currently the latest)
	// main-branch: content-type=application/json, content is JSON
	// we should always be able to to return some kind of error message
	//
	// also, the returned error message is not what we want to return
	// to the user, but this is what is currently returned to the user,
	// so the tests check for that. we will have to change this in the future.

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
			errorMessage: "Run out of attempts while querying the server",
		},
		{
			name:         "parse a non-json error body with json content type (loki 2.4.0,2.4.1,2.4.2)",
			body:         []byte("parse error at line 1, col 8: something is wrong"),
			contentType:  "application/json; charset=UTF-8",
			errorMessage: "Run out of attempts while querying the server",
		},
		{
			name:         "parse an error response in plain text",
			body:         []byte("parse error at line 1, col 8: something is wrong"),
			contentType:  "text/plain; charset=utf-8",
			errorMessage: "Run out of attempts while querying the server",
		},
	}

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			frames, err := runQuery(makeMockedClient(400, test.contentType, test.body), &lokiQuery{})

			require.Len(t, frames, 0)
			require.Error(t, err)
			require.EqualError(t, err, test.errorMessage)
		})
	}
}

type MockedRoundTripper struct {
	statusCode    int
	responseBytes []byte
	contentType   string
}

func (mockedRT *MockedRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	header := http.Header{}
	header.Add("Content-Type", mockedRT.contentType)
	return &http.Response{
		StatusCode: mockedRT.statusCode,
		Header:     header,
		Body:       ioutil.NopCloser(bytes.NewReader(mockedRT.responseBytes)),
	}, nil
}

func makeMockedClient(statusCode int, contentType string, responseBytes []byte) *client.DefaultClient {
	client := &client.DefaultClient{
		Address: "http://localhost:9999",
		Tripperware: func(t http.RoundTripper) http.RoundTripper {
			return &MockedRoundTripper{statusCode: statusCode, responseBytes: responseBytes, contentType: contentType}
		},
	}

	return client
}
