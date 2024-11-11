package tempo

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/stretchr/testify/assert"
)

func TestCreateMetricsQuery_Success(t *testing.T) {
	logger := backend.NewLoggerWith("logger", "tsdb.tempo.test")
	service := &Service{
		logger: logger,
	}
	dsInfo := &Datasource{
		URL: "http://tempo:3100",
	}
	queryVal := "{attribute=\"value\"}"
	stepVal := "14"
	query := &dataquery.TempoQuery{
		Query: &queryVal,
		Step:  &stepVal,
	}
	start := int64(1625097600)
	end := int64(1625184000)

	req, err := service.createMetricsQuery(context.Background(), dsInfo, query, start, end)
	assert.NoError(t, err)
	assert.NotNil(t, req)
	assert.Equal(t, "http://tempo:3100/api/metrics/query_range?end=1625184000&q=%7Battribute%3D%22value%22%7D&start=1625097600&step=14", req.URL.String())
	assert.Equal(t, "application/json", req.Header.Get("Accept"))
}
func TestCreateMetricsQuery_OnlyQuery(t *testing.T) {
	logger := backend.NewLoggerWith("logger", "tsdb.tempo.test")
	service := &Service{
		logger: logger,
	}
	dsInfo := &Datasource{
		URL: "http://tempo:3100",
	}
	queryVal := "{attribute=\"value\"}"
	query := &dataquery.TempoQuery{
		Query: &queryVal,
	}

	req, err := service.createMetricsQuery(context.Background(), dsInfo, query, 0, 0)
	assert.NoError(t, err)
	assert.NotNil(t, req)
	assert.Equal(t, "http://tempo:3100/api/metrics/query_range?q=%7Battribute%3D%22value%22%7D", req.URL.String())
	assert.Equal(t, "application/json", req.Header.Get("Accept"))
}

func TestCreateMetricsQuery_URLParseError(t *testing.T) {
	logger := backend.NewLoggerWith("logger", "tsdb.tempo.test")
	service := &Service{
		logger: logger,
	}
	dsInfo := &Datasource{
		URL: "http://[::1]:namedport",
	}
	queryVal := "{attribute=\"value\"}"
	query := &dataquery.TempoQuery{
		Query: &queryVal,
	}
	start := int64(1625097600)
	end := int64(1625184000)

	req, err := service.createMetricsQuery(context.Background(), dsInfo, query, start, end)
	assert.Error(t, err)
	assert.Nil(t, req)
}
