package cloudwatch

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func newHTTPResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     make(http.Header),
	}
}

func TestPromqlSignedGet(t *testing.T) {
	orig := NewPromQLHTTPClient
	t.Cleanup(func() { NewPromQLHTTPClient = orig })

	dsWith := func(region, endpoint string) *DataSource {
		return &DataSource{Settings: models.CloudWatchSettings{
			AWSDatasourceSettings: awsds.AWSDatasourceSettings{Region: region, Endpoint: endpoint},
		}}
	}

	t.Run("resolves the region into the monitoring endpoint URL", func(t *testing.T) {
		var got *http.Request
		NewPromQLHTTPClient = func(_ httpclient.Options) (*http.Client, error) {
			return &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				got = r
				return newHTTPResponse(http.StatusOK, `{"status":"success"}`), nil
			})}, nil
		}

		ds := dsWith("us-east-1", "")
		body, status, err := ds.promqlSignedGet(context.Background(), "eu-west-2", "/api/v1/labels", url.Values{"match": {"up"}}, time.Second)

		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, status)
		assert.JSONEq(t, `{"status":"success"}`, string(body))
		require.NotNil(t, got)
		assert.Equal(t, http.MethodGet, got.Method)
		assert.Equal(t, "https://monitoring.eu-west-2.amazonaws.com/api/v1/labels?match=up", got.URL.String())
	})

	t.Run("falls back to the configured region when region is empty or default", func(t *testing.T) {
		for _, region := range []string{"", defaultRegion} {
			var got *http.Request
			NewPromQLHTTPClient = func(_ httpclient.Options) (*http.Client, error) {
				return &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
					got = r
					return newHTTPResponse(http.StatusOK, `{}`), nil
				})}, nil
			}

			ds := dsWith("ap-southeast-1", "")
			_, _, err := ds.promqlSignedGet(context.Background(), region, "/api/v1/labels", nil, time.Second)

			require.NoError(t, err)
			require.NotNil(t, got)
			assert.Equal(t, "https://monitoring.ap-southeast-1.amazonaws.com/api/v1/labels", got.URL.String(),
				"region %q should fall back to the configured region", region)
		}
	})

	t.Run("a custom endpoint takes precedence over the resolver", func(t *testing.T) {
		var got *http.Request
		NewPromQLHTTPClient = func(_ httpclient.Options) (*http.Client, error) {
			return &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				got = r
				return newHTTPResponse(http.StatusOK, `{}`), nil
			})}, nil
		}

		ds := dsWith("us-east-1", "https://custom.example.com/")
		_, _, err := ds.promqlSignedGet(context.Background(), "us-east-1", "/api/v1/labels", nil, time.Second)

		require.NoError(t, err)
		require.NotNil(t, got)
		assert.Equal(t, "https://custom.example.com/api/v1/labels", got.URL.String(),
			"trailing slash on the custom endpoint should not produce a double slash")
	})

	t.Run("returns the status code and body for non-200 responses", func(t *testing.T) {
		NewPromQLHTTPClient = func(_ httpclient.Options) (*http.Client, error) {
			return &http.Client{Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
				return newHTTPResponse(http.StatusBadRequest, `{"status":"error"}`), nil
			})}, nil
		}

		ds := dsWith("us-east-1", "")
		body, status, err := ds.promqlSignedGet(context.Background(), "us-east-1", "/api/v1/query", nil, time.Second)

		require.NoError(t, err, "transport-level success should not be an error even for non-200")
		assert.Equal(t, http.StatusBadRequest, status)
		assert.JSONEq(t, `{"status":"error"}`, string(body))
	})

	t.Run("reuses a cached client for repeated requests with the same region and timeout", func(t *testing.T) {
		var built int
		NewPromQLHTTPClient = func(_ httpclient.Options) (*http.Client, error) {
			built++
			return &http.Client{Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
				return newHTTPResponse(http.StatusOK, `{}`), nil
			})}, nil
		}

		ds := dsWith("us-east-1", "")
		for range 3 {
			_, _, err := ds.promqlSignedGet(context.Background(), "us-east-1", "/api/v1/labels", nil, time.Second)
			require.NoError(t, err)
		}
		assert.Equal(t, 1, built, "client should be built once and reused across requests")

		_, _, err := ds.promqlSignedGet(context.Background(), "us-east-1", "/api/v1/labels", nil, 2*time.Second)
		require.NoError(t, err)
		assert.Equal(t, 2, built, "a different timeout should build a new client")
	})

	t.Run("transparently decompresses a gzipped response body", func(t *testing.T) {
		var buf bytes.Buffer
		gz := gzip.NewWriter(&buf)
		_, _ = gz.Write([]byte(`{"status":"success","data":["a","b"]}`))
		require.NoError(t, gz.Close())
		gzipped := buf.Bytes()

		NewPromQLHTTPClient = func(_ httpclient.Options) (*http.Client, error) {
			return &http.Client{Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
				resp := &http.Response{
					StatusCode: http.StatusOK,
					Body:       io.NopCloser(bytes.NewReader(gzipped)),
					Header:     make(http.Header),
				}
				resp.Header.Set("Content-Encoding", "gzip")
				return resp, nil
			})}, nil
		}

		ds := dsWith("us-east-1", "")
		body, status, err := ds.promqlSignedGet(context.Background(), "us-east-1", "/api/v1/labels", nil, time.Second)

		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, status)
		assert.JSONEq(t, `{"status":"success","data":["a","b"]}`, string(body))
	})

	t.Run("wraps transport errors", func(t *testing.T) {
		NewPromQLHTTPClient = func(_ httpclient.Options) (*http.Client, error) {
			return &http.Client{Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
				return nil, errors.New("boom")
			})}, nil
		}

		ds := dsWith("us-east-1", "")
		body, status, err := ds.promqlSignedGet(context.Background(), "us-east-1", "/api/v1/query", nil, time.Second)

		require.Error(t, err)
		assert.Equal(t, 0, status)
		assert.Nil(t, body)
		assert.Contains(t, err.Error(), "request failed")
	})
}
