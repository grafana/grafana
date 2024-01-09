package datasource

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseQueriesIntoQueryDataRequest(t *testing.T) {
	request := []byte(`{
		"queries": [
			{
				"refId": "A",
				"datasource": {
					"type": "grafana-googlesheets-datasource",
					"uid": "b1808c48-9fc9-4045-82d7-081781f8a553"
				},
				"cacheDurationSeconds": 300,
				"spreadsheet": "spreadsheetID",
				"range": "",
				"datasourceId": 4,
				"intervalMs": 30000,
				"maxDataPoints": 794
			}
		],
		"from": "1692624667389",
		"to": "1692646267389"
	}`)

	parsedDataQuery, err := readQueries(request)
	require.NoError(t, err)
	require.Equal(t, len(parsedDataQuery), 1)
}
