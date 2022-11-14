package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/Masterminds/semver"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/stretchr/testify/require"
)

// these snapshot-tests test the whole request-response flow:
// the inputs:
// - the backend.DataQuery query
// - the elastic-response json
// the snapshot verifies:
// - the elastic-request json
// - the dataframe result

type flowTestRoundTripper struct {
	requestCallback func(req *http.Request)
	body            []byte
}

// we fake the http-request-call. we return a fixed byte-array (defined by the test snapshot),
// and we also check if the http-request-object has the correct data
func (rt *flowTestRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	rt.requestCallback(req)
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{},
		Body:       io.NopCloser(bytes.NewReader(rt.body)),
	}, nil
}

// we setup a fake datasource-info
func newFlowTestDsInfo(body []byte, reuestCallback func(req *http.Request)) *es.DatasourceInfo {
	client := http.Client{
		Transport: &flowTestRoundTripper{body: body, requestCallback: reuestCallback},
	}
	return &es.DatasourceInfo{
		ESVersion:                  semver.MustParse("8.5.0"),
		Interval:                   "Daily",
		Database:                   "[testdb-]YYYY.MM.DD",
		TimeField:                  "testtime",
		TimeInterval:               "1s",
		URL:                        "http://localhost:9200",
		HTTPClient:                 &client,
		MaxConcurrentShardRequests: 42,
		IncludeFrozen:              false,
		XPack:                      true,
	}
}

type flowTestQueryJSON struct {
	IntervalMs    int64
	MaxDataPoints int64
	RefID         string
}

// we take an array of json-bytes, that define the elastic queries,
// and create full backend.DataQuery objects from them
func newFlowTestQueries(jsonBytesArray [][]byte) ([]backend.DataQuery, error) {

	timeRange := backend.TimeRange{
		From: time.UnixMilli(1668422437218),
		To:   time.UnixMilli(1668422625668),
	}

	var queries []backend.DataQuery

	for _, jsonBytes := range jsonBytesArray {
		// we load in some values (interval, maxDataPoints, etc.) from the json
		var jsonInfo flowTestQueryJSON
		err := json.Unmarshal(jsonBytes, &jsonInfo)
		if err != nil {
			return nil, err
		}

		// we setup the DataQuery, with values loaded from the json
		query := backend.DataQuery{
			RefID:         jsonInfo.RefID,
			MaxDataPoints: jsonInfo.MaxDataPoints,
			Interval:      time.Duration(jsonInfo.IntervalMs) * time.Millisecond,
			TimeRange:     timeRange,
			JSON:          json.RawMessage(jsonBytes),
		}

		queries = append(queries, query)

	}

	return queries, nil
}

// a regex that matches the request-snapshot-filenames, and extracts the name of the test
var requestRe = regexp.MustCompile(`^(.*)\.request\.line\d+\.json$`)

// the "elastic request" is often in multiple json-snapshot-files,
// so we have to find them on disk, so we have to look at every file in
// the folder.
func findRequestSnapshots(t *testing.T) map[string][]string {
	allTestSnapshotFiles, err := os.ReadDir("testdata")
	require.NoError(t, err)

	snapshots := make(map[string][]string)

	for _, file := range allTestSnapshotFiles {
		fileName := file.Name()
		match := requestRe.FindStringSubmatch(fileName)
		if len(match) == 2 {
			testName := match[1]
			files := append(snapshots[testName], filepath.Join("testdata", fileName))
			snapshots[testName] = files
		}
	}

	return snapshots
}

func TestFlow(t *testing.T) {

	tt := []struct {
		name string
		path string
	}{
		{name: "simple test", path: "simple"},
	}

	requestSnapshots := findRequestSnapshots(t)

	for _, test := range tt {

		t.Run(test.name, func(t *testing.T) {
			goldenFileName := test.path + ".golden"

			responseFileName := filepath.Join("testdata", test.path+".response.json")
			responseBytes, err := os.ReadFile(responseFileName)
			require.NoError(t, err)

			queryFileName := filepath.Join("testdata", test.path+".query.json")
			queriesBytes, err := os.ReadFile(queryFileName)
			require.NoError(t, err)

			var requestLines [][]byte

			for _, fileName := range requestSnapshots[test.path] {
				bytes, err := os.ReadFile(fileName)
				require.NoError(t, err)
				requestLines = append(requestLines, bytes)
			}

			require.True(t, len(requestLines) > 0, "requestLines must not be empty")

			queries, err := newFlowTestQueries([][]byte{queriesBytes})
			require.NoError(t, err)

			dsInfo := newFlowTestDsInfo(responseBytes, func(req *http.Request) {
				defer req.Body.Close()
				reqBytes, err := io.ReadAll(req.Body)
				require.NoError(t, err)

				reqLines := strings.Split(strings.TrimSpace(string(reqBytes)), "\n")
				require.Len(t, reqLines, len(requestLines))

				for i, expectedRequestLine := range requestLines {
					actualRequestLine := reqLines[i]
					require.JSONEq(t, string(expectedRequestLine), string(actualRequestLine))
				}
			})

			result, err := queryData(context.Background(), queries, dsInfo, intervalv2.NewCalculator())

			require.NoError(t, err)

			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)

			experimental.CheckGoldenJSONResponse(t, "testdata", goldenFileName, &queryRes, false)
		})
	}

}
