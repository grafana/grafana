package influxdb

import (
	"context"
	"io/ioutil"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExecutor_createRequest(t *testing.T) {
	datasource := &models.DatasourceInfo{
		URL:      "http://awesome-influxdb:1337",
		Database: "awesome-db",
		HTTPMode: "GET",
	}
	query := "SELECT awesomeness FROM somewhere"
	s := &Service{
		QueryParser:    &InfluxdbQueryParser{},
		ResponseParser: &ResponseParser{},
	}

	t.Run("createRequest with GET httpMode", func(t *testing.T) {
		glog = log.New("test")
		req, err := s.createRequest(context.Background(), datasource, query)

		require.NoError(t, err)

		assert.Equal(t, "GET", req.Method)

		q := req.URL.Query().Get("q")
		assert.Equal(t, query, q)

		assert.Nil(t, req.Body)
	})

	t.Run("createRequest with POST httpMode", func(t *testing.T) {
		datasource.HTTPMode = "POST"
		req, err := s.createRequest(context.Background(), datasource, query)
		require.NoError(t, err)

		assert.Equal(t, "POST", req.Method)

		q := req.URL.Query().Get("q")
		assert.Empty(t, q)

		body, err := ioutil.ReadAll(req.Body)
		require.NoError(t, err)

		testBodyValues := url.Values{}
		testBodyValues.Add("q", query)
		testBody := testBodyValues.Encode()
		assert.Equal(t, testBody, string(body))
	})

	t.Run("createRequest with PUT httpMode", func(t *testing.T) {
		datasource.HTTPMode = "PUT"
		_, err := s.createRequest(context.Background(), datasource, query)
		require.EqualError(t, err, ErrInvalidHttpMode.Error())
	})
}
