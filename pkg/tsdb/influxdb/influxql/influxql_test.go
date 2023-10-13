package influxql

import (
	"context"
	"io"
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
