package cloudwatch

import (
	"context"
	"net/http"
	"net/url"
	"testing"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

// stubPromQLResponse swaps the NewPromQLHTTPClient factory for one whose
// transport records the outgoing request and returns the given status/body,
// so the handlers can be exercised without real signing or network. It returns
// a pointer to the captured request for assertions on forwarded parameters.
func stubPromQLResponse(t *testing.T, status int, body string) **http.Request {
	t.Helper()
	orig := NewPromQLHTTPClient
	t.Cleanup(func() { NewPromQLHTTPClient = orig })

	captured := new(*http.Request)
	NewPromQLHTTPClient = func(_ httpclient.Options) (*http.Client, error) {
		return &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			*captured = r
			return newHTTPResponse(status, body), nil
		})}, nil
	}
	return captured
}

func promQLTestDatasource() *DataSource {
	return &DataSource{Settings: models.CloudWatchSettings{
		AWSDatasourceSettings: awsds.AWSDatasourceSettings{Region: "us-east-1"},
	}}
}

func TestBuildPromQLForwardParams(t *testing.T) {
	t.Run("forwards start, end, limit unchanged", func(t *testing.T) {
		in := url.Values{
			"start": []string{"1000"},
			"end":   []string{"2000"},
			"limit": []string{"500"},
		}
		out := buildPromQLForwardParams(in)
		assert.Equal(t, "1000", out.Get("start"))
		assert.Equal(t, "2000", out.Get("end"))
		assert.Equal(t, "500", out.Get("limit"))
	})

	t.Run("renames match to match[] for AWS PromQL", func(t *testing.T) {
		in := url.Values{"match": []string{`{__name__="CPUUtilization"}`}}
		out := buildPromQLForwardParams(in)
		assert.Equal(t, `{__name__="CPUUtilization"}`, out.Get("match[]"))
		assert.Equal(t, "", out.Get("match"), "original `match` key should not be forwarded")
	})

	t.Run("drops empty values", func(t *testing.T) {
		in := url.Values{
			"start": []string{""},
			"end":   []string{""},
			"match": []string{""},
		}
		out := buildPromQLForwardParams(in)
		assert.Empty(t, out, "no params should be forwarded when all are empty")
	})

	t.Run("does not forward region or other unrelated params", func(t *testing.T) {
		in := url.Values{
			"region":   []string{"us-east-1"},
			"labelKey": []string{"InstanceId"},
			"start":    []string{"1000"},
		}
		out := buildPromQLForwardParams(in)
		assert.Equal(t, "", out.Get("region"))
		assert.Equal(t, "", out.Get("labelKey"))
		assert.Equal(t, "1000", out.Get("start"))
	})
}

func TestDecodePromQLStringListResponse(t *testing.T) {
	t.Run("parses success response with values", func(t *testing.T) {
		data, err := decodePromQLStringListResponse([]byte(`{"status":"success","data":["a","b","c"]}`))
		require.NoError(t, err)
		assert.Equal(t, []string{"a", "b", "c"}, data)
	})

	t.Run("returns empty slice (not nil) when data is null", func(t *testing.T) {
		data, err := decodePromQLStringListResponse([]byte(`{"status":"success","data":null}`))
		require.NoError(t, err)
		assert.NotNil(t, data)
		assert.Empty(t, data)
	})

	t.Run("returns empty slice when data field is omitted", func(t *testing.T) {
		data, err := decodePromQLStringListResponse([]byte(`{"status":"success"}`))
		require.NoError(t, err)
		assert.NotNil(t, data)
		assert.Empty(t, data)
	})

	t.Run("errors when status is not success", func(t *testing.T) {
		_, err := decodePromQLStringListResponse([]byte(`{"status":"error","errorType":"bad_data","error":"invalid match expression"}`))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "bad_data")
		assert.Contains(t, err.Error(), "invalid match expression")
	})

	t.Run("errors on malformed JSON", func(t *testing.T) {
		_, err := decodePromQLStringListResponse([]byte(`{"status":`))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to parse")
	})

	t.Run("errors when status field is missing entirely", func(t *testing.T) {
		_, err := decodePromQLStringListResponse([]byte(`{"data":["a"]}`))
		require.Error(t, err)
	})
}

func TestPromQLLabelKeysHandler(t *testing.T) {
	t.Run("forwards params and returns the data array", func(t *testing.T) {
		got := stubPromQLResponse(t, http.StatusOK, `{"status":"success","data":["__name__","InstanceId"]}`)

		ds := promQLTestDatasource()
		params := url.Values{
			"region": {"eu-west-2"},
			"match":  {`{__name__="CPUUtilization"}`},
			"start":  {"1000"},
			"end":    {"2000"},
		}
		out, httpErr := ds.PromQLLabelKeysHandler(context.Background(), params)

		require.Nil(t, httpErr)
		assert.JSONEq(t, `["__name__","InstanceId"]`, string(out))

		require.NotNil(t, *got)
		reqURL := (*got).URL
		assert.Equal(t, "monitoring.eu-west-2.amazonaws.com", reqURL.Host)
		assert.Equal(t, "/api/v1/labels", reqURL.Path)
		// match is renamed to match[]; region is not forwarded upstream.
		assert.Equal(t, `{__name__="CPUUtilization"}`, reqURL.Query().Get("match[]"))
		assert.Equal(t, "1000", reqURL.Query().Get("start"))
		assert.Equal(t, "2000", reqURL.Query().Get("end"))
		assert.Empty(t, reqURL.Query().Get("region"))
		assert.Empty(t, reqURL.Query().Get("match"))
	})

	t.Run("falls back to the configured region", func(t *testing.T) {
		got := stubPromQLResponse(t, http.StatusOK, `{"status":"success","data":[]}`)

		ds := promQLTestDatasource()
		_, httpErr := ds.PromQLLabelKeysHandler(context.Background(), url.Values{})

		require.Nil(t, httpErr)
		require.NotNil(t, *got)
		assert.Equal(t, "monitoring.us-east-1.amazonaws.com", (*got).URL.Host)
	})

	t.Run("returns an error for a non-200 status", func(t *testing.T) {
		stubPromQLResponse(t, http.StatusForbidden, `access denied`)

		ds := promQLTestDatasource()
		out, httpErr := ds.PromQLLabelKeysHandler(context.Background(), url.Values{})

		require.NotNil(t, httpErr)
		assert.Nil(t, out)
		assert.Equal(t, http.StatusInternalServerError, httpErr.StatusCode)
	})

	t.Run("returns an error for HTTP 200 with status=error", func(t *testing.T) {
		stubPromQLResponse(t, http.StatusOK, `{"status":"error","errorType":"bad_data","error":"invalid match"}`)

		ds := promQLTestDatasource()
		out, httpErr := ds.PromQLLabelKeysHandler(context.Background(), url.Values{})

		require.NotNil(t, httpErr)
		assert.Nil(t, out)
		assert.Contains(t, httpErr.Message, "bad_data")
	})
}

func TestPromQLLabelValuesHandler(t *testing.T) {
	t.Run("escapes the label key into the request path", func(t *testing.T) {
		got := stubPromQLResponse(t, http.StatusOK, `{"status":"success","data":["i-123"]}`)

		ds := promQLTestDatasource()
		out, httpErr := ds.PromQLLabelValuesHandler(context.Background(), url.Values{"labelKey": {"Instance/Id"}})

		require.Nil(t, httpErr)
		assert.JSONEq(t, `["i-123"]`, string(out))
		require.NotNil(t, *got)
		assert.Equal(t, "/api/v1/label/Instance%2FId/values", (*got).URL.EscapedPath())
	})

	t.Run("requires the labelKey parameter", func(t *testing.T) {
		ds := promQLTestDatasource()
		out, httpErr := ds.PromQLLabelValuesHandler(context.Background(), url.Values{})

		require.NotNil(t, httpErr)
		assert.Nil(t, out)
		assert.Equal(t, http.StatusBadRequest, httpErr.StatusCode)
	})

	t.Run("returns an empty list (not an error) for 404 and 400", func(t *testing.T) {
		for _, status := range []int{http.StatusNotFound, http.StatusBadRequest} {
			stubPromQLResponse(t, status, `no such label`)

			ds := promQLTestDatasource()
			out, httpErr := ds.PromQLLabelValuesHandler(context.Background(), url.Values{"labelKey": {"InstanceId"}})

			require.Nil(t, httpErr, "status %d should not be an error", status)
			assert.JSONEq(t, `[]`, string(out))
		}
	})

	t.Run("returns an error for other non-200 statuses", func(t *testing.T) {
		stubPromQLResponse(t, http.StatusForbidden, `access denied`)

		ds := promQLTestDatasource()
		out, httpErr := ds.PromQLLabelValuesHandler(context.Background(), url.Values{"labelKey": {"InstanceId"}})

		require.NotNil(t, httpErr)
		assert.Nil(t, out)
		assert.Equal(t, http.StatusInternalServerError, httpErr.StatusCode)
	})
}
