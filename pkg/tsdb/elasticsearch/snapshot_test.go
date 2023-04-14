package elasticsearch

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"
)

// these snapshot-tests test the whole request-response flow:
// the inputs:
// - the backend.DataQuery query
// - the elastic-response json
// the snapshot verifies:
// - the elastic-request json
// - the dataframe result

// a regex that matches the request-snapshot-filenames, and extracts the name of the test
var requestRe = regexp.MustCompile(`^(.*)\.request\.line\d+\.json$`)

// the "elastic request" is often in multiple json-snapshot-files,
// so we have to find them on disk, so we have to look at every file in
// the folder.
func findRequestSnapshots(t *testing.T, folder string) map[string][]string {
	allTestSnapshotFiles, err := os.ReadDir(folder)
	require.NoError(t, err)

	snapshots := make(map[string][]string)

	for _, file := range allTestSnapshotFiles {
		fileName := file.Name()
		match := requestRe.FindStringSubmatch(fileName)
		if len(match) == 2 {
			testName := match[1]
			files := append(snapshots[testName], filepath.Join(folder, fileName))
			snapshots[testName] = files
		}
	}

	return snapshots
}

// a regex that matches the response-snapshot-filenames, and extracts the name of the test
var responseRe = regexp.MustCompile(`^([^\.]+)\.[^\.]+.golden.jsonc$`)

func findResponseSnapshotCounts(t *testing.T, folder string) map[string]int {
	allTestSnapshotFiles, err := os.ReadDir(folder)
	require.NoError(t, err)

	snapshots := make(map[string]int)

	for _, file := range allTestSnapshotFiles {
		fileName := file.Name()
		match := responseRe.FindStringSubmatch(fileName)
		if len(match) == 2 {
			testName := match[1]
			snapshots[testName] = snapshots[testName] + 1
		}
	}

	return snapshots
}

func TestRequestSnapshots(t *testing.T) {
	tt := []struct {
		name string
		path string
	}{
		{name: "simple metric test", path: "metric_simple"},
		{name: "complex metric test", path: "metric_complex"},
		{name: "multi metric test", path: "metric_multi"},
		{name: "raw data test", path: "raw_data"},
		{name: "raw document test", path: "raw_document"},
		{name: "logs test", path: "logs"},
	}

	queryHeader := []byte(`
	{
		"ignore_unavailable": true,
		"index": "testdb-2022.11.14",
		"search_type": "query_then_fetch"
	}
	`)

	requestSnapshots := findRequestSnapshots(t, "testdata_request")

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			responseBytes := []byte(`{"responses":[]}`)

			queriesFileName := filepath.Join("testdata_request", test.path+".queries.json")
			queriesBytes, err := os.ReadFile(filepath.Clean(queriesFileName))
			require.NoError(t, err)

			var requestLines [][]byte

			for _, fileName := range requestSnapshots[test.path] {
				bytes, err := os.ReadFile(filepath.Clean(fileName))
				require.NoError(t, err)
				requestLines = append(requestLines, bytes)
			}

			require.True(t, len(requestLines) > 0, "requestLines must not be empty")

			result, err := queryDataTest(queriesBytes, responseBytes)
			require.NoError(t, err)

			reqLines := strings.Split(strings.TrimSpace(string(result.requestBytes)), "\n")
			require.Len(t, reqLines, len(requestLines)*2)

			for i, expectedRequestLine := range requestLines {
				actualRequestHeaderLine := reqLines[2*i]
				actualRequestLine := reqLines[2*i+1]
				require.JSONEq(t, string(queryHeader), actualRequestHeaderLine, fmt.Sprintf("invalid request-header at index: %v", i))
				require.JSONEq(t, string(expectedRequestLine), actualRequestLine, fmt.Sprintf("invalid request at index: %v", i))
			}
		})
	}
}

func TestResponseSnapshots(t *testing.T) {
	tt := []struct {
		name string
		path string
	}{
		{name: "simple metric test", path: "metric_simple"},
		{name: "complex metric test", path: "metric_complex"},
		{name: "multi metric test", path: "metric_multi"},
		{name: "metric avg test", path: "metric_avg"},
		{name: "metric percentiles test", path: "metric_percentiles"},
		{name: "metric top_metrics test", path: "metric_top_metrics"},
		{name: "metric extended_stats test", path: "metric_extended_stats"},
		{name: "raw data test", path: "raw_data"},
		{name: "logs test", path: "logs"},
	}

	snapshotCount := findResponseSnapshotCounts(t, "testdata_response")

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			responseFileName := filepath.Join("testdata_response", test.path+".response.json")
			responseBytes, err := os.ReadFile(filepath.Clean(responseFileName))
			require.NoError(t, err)

			queriesFileName := filepath.Join("testdata_response", test.path+".queries.json")
			queriesBytes, err := os.ReadFile(filepath.Clean(queriesFileName))
			require.NoError(t, err)

			result, err := queryDataTest(queriesBytes, responseBytes)
			require.NoError(t, err)

			// first we need to test that the number of items in `result.response.Responses`,
			// is exactly the same as the count of our response snapshot files
			// (this is so that we avoid situations where we provide more snapshot-files than
			// what is returned)

			expectedResponseCount := snapshotCount[test.path]
			require.True(t, expectedResponseCount > 0, "response snapshots not found")

			require.Len(t, result.response.Responses, expectedResponseCount)

			for refId, dataRes := range result.response.Responses {
				goldenFileName := fmt.Sprintf("%v.%v.golden", test.path, strings.ToLower(refId))
				// we make a copy of the variable to avoid this linter-warning:
				// "G601: Implicit memory aliasing in for loop."
				dataResCopy := dataRes
				experimental.CheckGoldenJSONResponse(t, "testdata_response", goldenFileName, &dataResCopy, false)
			}
		})
	}
}
