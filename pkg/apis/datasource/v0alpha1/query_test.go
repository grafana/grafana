package v0alpha1_test

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
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
				"datasourceId": 4,
				"intervalMs": 30000,
				"maxDataPoints": 794
			},
			{
				"refId": "Z",
				"datasource": "old",
				"maxDataPoints": 10,
				"timeRange": {
					"from": "100",
					"to": "200"
				},
				"queryType": "foo"
			}
		],
		"from": "1692624667389",
		"to": "1692646267389"
	}`)

	req := &datasourceV0.QueryDataRequest{}
	err := json.Unmarshal(request, req)
	require.NoError(t, err)

	require.Len(t, req.Queries, 2)
	require.Equal(t, "b1808c48-9fc9-4045-82d7-081781f8a553", req.Queries[0].Datasource.UID)
	require.Equal(t, "spreadsheetID", req.Queries[0].GetString("spreadsheet"))

	// Write the query (with additional spreadsheetID) to JSON
	out, err := json.MarshalIndent(req.Queries[0], "", "  ")
	require.NoError(t, err)

	// And read it back with standard JSON marshal functions
	query := &data.DataQuery{}
	err = json.Unmarshal(out, query)
	require.NoError(t, err)
	require.Equal(t, "spreadsheetID", req.Queries[0].GetString("spreadsheet"))

	// The second query has an explicit time range, and legacy datasource name
	out, err = json.MarshalIndent(req.Queries[1], "", "  ")
	require.NoError(t, err)
	// fmt.Printf("%s\n", string(out))
	require.JSONEq(t, `{
		"datasource": {
		  "type": "", ` /* NOTE! this implies legacy naming */ +`
		  "uid": "old"
		},
		"maxDataPoints": 10,
		"queryType": "foo",
		"refId": "Z",
		"timeRange": {
		  "from": "100",
		  "to": "200"
		}
	  }`, string(out))
}

func TestGetResponseCode(t *testing.T) {
	t.Run("return 200 if no errors in responses", func(t *testing.T) {
		assert.Equal(t, 200, datasourceV0.GetResponseCode(&backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {
					Error: nil,
				},
				"B": {
					Error: nil,
				},
			},
		}))
	})
	t.Run("return 400 if there is an error in the responses but no status code", func(t *testing.T) {
		assert.Equal(t, 400, datasourceV0.GetResponseCode(&backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {
					Error: fmt.Errorf("some wild error"),
				},
			},
		}))
	})
	t.Run("return 400 if there is a partial error but no status code", func(t *testing.T) {
		assert.Equal(t, 400, datasourceV0.GetResponseCode(&backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {
					Error: nil,
				},
				"B": {
					Error: fmt.Errorf("some partial error"),
				},
			},
		}))
	})
	t.Run("return 400 for a downstream error the SDK could not classify", func(t *testing.T) {
		// The SDK's ErrorSourceMiddleware stamps StatusUnknown (500) on any error it cannot
		// classify, including ones it has already identified as downstream. A downstream
		// failure is the data source's, not this API server's, so it must not surface as 5xx.
		assert.Equal(t, 400, datasourceV0.GetResponseCode(&backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {
					Error:       fmt.Errorf("database not found: db_example"),
					ErrorSource: backend.ErrorSourceDownstream,
					Status:      backend.StatusUnknown,
				},
			},
		}))
	})
	t.Run("preserve an explicit downstream 4xx", func(t *testing.T) {
		assert.Equal(t, 401, datasourceV0.GetResponseCode(&backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {
					Error:       fmt.Errorf("unauthorized access"),
					ErrorSource: backend.ErrorSourceDownstream,
					Status:      backend.StatusUnauthorized,
				},
			},
		}))
	})
	t.Run("return 400 for a downstream 5xx", func(t *testing.T) {
		assert.Equal(t, 400, datasourceV0.GetResponseCode(&backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {
					Error:       fmt.Errorf(`Get "http://10.0.0.1:8086/query": dial tcp: i/o timeout`),
					ErrorSource: backend.ErrorSourceDownstream,
					Status:      backend.StatusTimeout,
				},
			},
		}))
	})
	t.Run("return the status unchanged for a plugin error", func(t *testing.T) {
		assert.Equal(t, 500, datasourceV0.GetResponseCode(&backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {
					Error:       fmt.Errorf("plugin blew up"),
					ErrorSource: backend.ErrorSourcePlugin,
					Status:      backend.StatusInternal,
				},
			},
		}))
	})
	t.Run("a plugin error outranks a downstream error regardless of map order", func(t *testing.T) {
		// Responses is a map, so iteration order is randomized. Returning on the first
		// errored entry made a batch holding both kinds flap between 400 and 500. A plugin
		// error has to win: matching the SDK's ErrorSourceMiddleware, and so that a real
		// plugin failure is never hidden behind a tenant's bad config.
		rsp := &backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {
					Error:       fmt.Errorf("database not found: db_example"),
					ErrorSource: backend.ErrorSourceDownstream,
					Status:      backend.StatusUnknown,
				},
				"B": {
					Error:       fmt.Errorf("plugin blew up"),
					ErrorSource: backend.ErrorSourcePlugin,
					Status:      backend.StatusInternal,
				},
			},
		}

		for i := range 100 {
			require.Equal(t, 500, datasourceV0.GetResponseCode(rsp), "iteration %d", i)
		}
	})
	t.Run("the reported status is stable when several downstream errors disagree", func(t *testing.T) {
		rsp := &backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {
					Error:       fmt.Errorf("unauthorized access"),
					ErrorSource: backend.ErrorSourceDownstream,
					Status:      backend.StatusUnauthorized,
				},
				"B": {
					Error:       fmt.Errorf("bucket not found"),
					ErrorSource: backend.ErrorSourceDownstream,
					Status:      backend.StatusNotFound,
				},
			},
		}

		for i := range 100 {
			require.Equal(t, 401, datasourceV0.GetResponseCode(rsp), "iteration %d", i)
		}
	})
	t.Run("a downstream error from a plugin that sets no status survives the wire as 400", func(t *testing.T) {
		// End-to-end guard for the shape that actually caused the incident. The influxdb
		// plugin labels the error downstream but leaves Status unset, and the SDK stamps
		// StatusUnknown (500) onto it during protobuf conversion. ErrorSource has to survive
		// that trip for this function to do its job, so assert on the whole chain rather
		// than on a hand-built response.
		pluginSide := &backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {
					Error:       fmt.Errorf("database not found: db_example"),
					ErrorSource: backend.ErrorSourceDownstream,
				},
			},
		}

		wire, err := backend.ToProto().QueryDataResponse(backend.DataFrameFormat_JSON, pluginSide)
		require.NoError(t, err)
		require.Equal(t, int32(500), wire.Responses["A"].Status, "the SDK is expected to stamp 500 here")
		require.Equal(t, "downstream", wire.Responses["A"].ErrorSource)

		apiserverSide, err := backend.FromProto().QueryDataResponse(wire)
		require.NoError(t, err)

		assert.Equal(t, 400, datasourceV0.GetResponseCode(apiserverSide))
	})
}
