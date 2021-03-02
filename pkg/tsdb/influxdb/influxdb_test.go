package influxdb

import (
	"context"
	"io/ioutil"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInfluxDBExecutor_createRequest(t *testing.T) {
	datasource := &models.DataSource{
		Url:      "http://awesome-influxdb:1337",
		Database: "awesome-db",
		JsonData: simplejson.New(),
	}
	query := "SELECT awesomeness FROM somewhere"
	e := &InfluxDBExecutor{
		QueryParser:    &InfluxdbQueryParser{},
		ResponseParser: &ResponseParser{},
	}

	t.Run("createRequest with GET httpMode", func(t *testing.T) {
		req, err := e.createRequest(context.Background(), datasource, query)
		require.NoError(t, err)

		assert.Equal(t, "GET", req.Method)

		q := req.URL.Query().Get("q")
		assert.Equal(t, query, q)

		assert.Nil(t, req.Body)
	})

	t.Run("createRequest with POST httpMode", func(t *testing.T) {
		datasource.JsonData.Set("httpMode", "POST")
		req, err := e.createRequest(context.Background(), datasource, query)
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
		datasource.JsonData.Set("httpMode", "PUT")
		_, err := e.createRequest(context.Background(), datasource, query)
		require.EqualError(t, err, ErrInvalidHttpMode.Error())
	})
}
