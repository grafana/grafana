package influxdb

import (
	"context"
	"io"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

func TestExecutor_createRequest(t *testing.T) {
	datasource := &models.DatasourceInfo{
		URL:      "http://awesome-influxdb:1337",
		DbName:   "awesome-db",
		HTTPMode: "GET",
	}
	query := "SELECT awesomeness FROM somewhere"
	s := &Service{
		queryParser:    &InfluxdbQueryParser{},
		responseParser: &ResponseParser{},
	}

	t.Run("createRequest with GET httpMode", func(t *testing.T) {
		req, err := s.createRequest(context.Background(), logger, datasource, query)

		require.NoError(t, err)

		assert.Equal(t, "GET", req.Method)

		q := req.URL.Query().Get("q")
		assert.Equal(t, query, q)

		assert.Nil(t, req.Body)
	})

	t.Run("createRequest with POST httpMode", func(t *testing.T) {
		datasource.HTTPMode = "POST"
		req, err := s.createRequest(context.Background(), logger, datasource, query)
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
		_, err := s.createRequest(context.Background(), logger, datasource, query)
		require.EqualError(t, err, ErrInvalidHttpMode.Error())
	})
}
