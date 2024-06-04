package influxql

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

func TestExecutor_createRequest(t *testing.T) {
	logger := log.New("tsdb.influx_influxql_test")
	datasource := &models.DatasourceInfo{
		URL:      "http://awesome-influxdb:1337",
		DbName:   "awesome-db",
		HTTPMode: "GET",
	}
	query := "SELECT awesomeness FROM somewhere"

	t.Run("createRequest with GET httpMode", func(t *testing.T) {
		req, err := createRequest(context.Background(), logger, datasource, query, defaultRetentionPolicy)

		require.NoError(t, err)

		assert.Equal(t, "GET", req.Method)

		q := req.URL.Query().Get("q")
		assert.Equal(t, query, q)

		assert.Nil(t, req.Body)
	})

	t.Run("createRequest with POST httpMode", func(t *testing.T) {
		datasource.HTTPMode = "POST"
		req, err := createRequest(context.Background(), logger, datasource, query, defaultRetentionPolicy)
		require.NoError(t, err)

		assert.Equal(t, "POST", req.Method)

		q := req.URL.Query().Get("q")
		assert.Empty(t, q)

		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)

		testBodyValues := url.Values{}
		testBodyValues.Add("q", query)
		testBody := testBodyValues.Encode()
		assert.Equal(t, testBody, string(body))
	})

	t.Run("createRequest with PUT httpMode", func(t *testing.T) {
		datasource.HTTPMode = "PUT"
		_, err := createRequest(context.Background(), logger, datasource, query, defaultRetentionPolicy)
		require.EqualError(t, err, ErrInvalidHttpMode.Error())
	})
}

func TestReadCustomMetadata(t *testing.T) {
	t.Run("should read nothing if no X-Grafana-Meta-Add-<Thing> header exists", func(t *testing.T) {
		header := http.Header{}
		header.Add("content-type", "text/html")
		header.Add("content-encoding", "gzip")
		res := &http.Response{
			Header: header,
		}
		result := readCustomMetadata(res)
		require.Nil(t, result)
	})

	t.Run("should read X-Grafana-Meta-Add-<Thing> header", func(t *testing.T) {
		header := http.Header{}
		header.Add("content-type", "text/html")
		header.Add("content-encoding", "gzip")
		header.Add("X-Grafana-Meta-Add-TestThing", "test1234")
		res := &http.Response{
			Header: header,
		}
		result := readCustomMetadata(res)
		expected := map[string]any{
			"testthing": "test1234",
		}
		require.NotNil(t, result)
		require.Equal(t, expected, result)
	})

	t.Run("should read multiple X-Grafana-Meta-Add-<Thing> header", func(t *testing.T) {
		header := http.Header{}
		header.Add("content-type", "text/html")
		header.Add("content-encoding", "gzip")
		header.Add("X-Grafana-Meta-Add-TestThing", "test111")
		header.Add("X-Grafana-Meta-Add-TestThing2", "test222")
		header.Add("X-Grafana-Meta-Add-Test-Other", "other")
		res := &http.Response{
			Header: header,
		}
		result := readCustomMetadata(res)
		expected := map[string]any{
			"testthing":  "test111",
			"testthing2": "test222",
			"test-other": "other",
		}
		require.NotNil(t, result)
		require.Equal(t, expected, result)
	})
}
