package elasticsearch

import (
	"errors"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func TestErrorAvgMissingField(t *testing.T) {
	query := []byte(`
	[
		{
			"refId": "A",
			"metrics": [
			{ "type": "avg", "id": "1" }
			],
			"bucketAggs": [
			{ "type": "date_histogram", "field": "@timestamp", "id": "2" }
			]
		}
	]
	`)

	response := []byte(`
	{
		"error": {
		  "reason": "Required one of fields [field, script], but none were specified. ",
		  "root_cause": [
			{
			  "reason": "Required one of fields [field, script], but none were specified. ",
			  "type": "illegal_argument_exception"
			}
		  ],
		  "type": "illegal_argument_exception"
		},
		"status": 400
	  }
	`)

	result, err := queryDataTestWithResponseCode(query, 400, response)
	require.NoError(t, err)

	// FIXME: we should return the received error message
	require.Equal(t, "unexpected status code: 400", result.response.Responses["A"].Error.Error())
	require.Equal(t, backend.ErrorSourceDownstream, result.response.Responses["A"].ErrorSource)
}

func TestErrorAvgMissingFieldNoDetailedErrors(t *testing.T) {
	query := []byte(`
	[
		{
			"refId": "A",
			"metrics": [
			{ "type": "avg", "id": "1" }
			],
			"bucketAggs": [
			{ "type": "date_histogram", "field": "@timestamp", "id": "2" }
			]
		}
	]
	`)

	// you can receive such an error if you configure elastic with:
	// http.detailed_errors.enabled=false
	response := []byte(`
	{ "error": "No ElasticsearchException found", "status": 400 }
	`)

	result, err := queryDataTestWithResponseCode(query, 400, response)
	require.NoError(t, err)

	// FIXME: we should return the received error message
	require.Equal(t, "unexpected status code: 400", result.response.Responses["A"].Error.Error())
}

func TestErrorTooManyDateHistogramBuckets(t *testing.T) {
	query := []byte(`
	[
		{
			"refId": "A",
			"metrics": [
			{ "type": "count", "id": "1" }
			],
			"bucketAggs": [
			{ "type": "date_histogram", "field": "@timestamp", "settings": { "interval": "10s" }, "id": "2" }
			]
		}
	]
	`)

	response := []byte(`
	{
		"responses": [
			{
				"error": {
					"caused_by": {
						"max_buckets": 65536,
						"reason": "Trying to create too many buckets. Must be less than or equal to: [65536].",
						"type": "too_many_buckets_exception"
					},
					"reason": "",
					"root_cause": [],
					"type": "search_phase_execution_exception"
				},
				"status": 503
			}
		]
	}
	`)

	result, err := queryDataTestWithResponseCode(query, 200, response)
	require.NoError(t, err)

	require.Len(t, result.response.Responses, 1)

	dataResponse, ok := result.response.Responses["A"]

	require.True(t, ok)
	require.Len(t, dataResponse.Frames, 0)
	require.ErrorContains(t, dataResponse.Error, "Trying to create too many buckets. Must be less than or equal to: [65536].")
	var sourceErr backend.ErrorWithSource
	ok = errors.As(dataResponse.Error, &sourceErr)
	require.True(t, ok)
	require.Equal(t, sourceErr.ErrorSource().String(), "downstream")
}

func TestNonElasticError(t *testing.T) {
	query := []byte(`
	[
		{
			"refId": "A",
			"metrics": [
			{ "type": "count", "id": "1" }
			],
			"bucketAggs": [
			{ "type": "date_histogram", "field": "@timestamp", "settings": { "interval": "10s" }, "id": "2" }
			]
		}
	]
	`)

	// this scenario is about an error-message that does not come directly from elastic,
	// but from a middleware/proxy server that for example reports that it is forbidden
	// to access the database for some reason.
	response := []byte(`Access to the database is forbidden`)

	res, err := queryDataTestWithResponseCode(query, 403, response)
	// FIXME: we should return something better.
	// currently it returns the error-message about being unable to decode JSON
	// it is not 100% clear what we should return to the browser
	// (and what to debug-log for example), we could return
	// at least something like "unknown response, http status code 403"
	require.NoError(t, err)
	require.Contains(t, res.response.Responses["A"].Error.Error(), "invalid character")
}
