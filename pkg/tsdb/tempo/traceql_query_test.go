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
	dsInfo := &DatasourceInfo{
		URL: "http://tempo:3100",
	}
	queryVal := "{attribute=\"value\"}"
	stepVal := "14"
	exemplarVal := int64(123)
	query := &dataquery.TempoQuery{
		Query:     &queryVal,
		Step:      &stepVal,
		Exemplars: &exemplarVal,
	}
	start := int64(1625097600)
	end := int64(1625184000)

	req, err := service.createMetricsQuery(context.Background(), dsInfo, query, start, end)
	assert.NoError(t, err)
	assert.NotNil(t, req)
	assert.Equal(t, "http://tempo:3100/api/metrics/query_range?end=1625184000&exemplars=123&q=%7Battribute%3D%22value%22%7D&start=1625097600&step=14", req.URL.String())
	assert.Equal(t, "application/json", req.Header.Get("Accept"))
}

func TestCreateMetricsQuery_OnlyQuery(t *testing.T) {
	logger := backend.NewLoggerWith("logger", "tsdb.tempo.test")
	service := &Service{
		logger: logger,
	}
	dsInfo := &DatasourceInfo{
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
	dsInfo := &DatasourceInfo{
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

func TestEmptyQueryString_ReturnsFalse(t *testing.T) {
	result := isMetricsQuery("")
	assert.False(t, result)
}

func TestQueryWithoutMetricsFunction_ReturnsFalse(t *testing.T) {
	result := isMetricsQuery("{.some = \"random query\"} && {} >> {}")
	assert.False(t, result)
}

func TestQueryWithRateFunction_ReturnsTrue(t *testing.T) {
	result := isMetricsQuery("{} | rate(foo)")
	assert.True(t, result)
}

func TestQueryWithAvgOverTimeFunction_ReturnsTrue(t *testing.T) {
	result := isMetricsQuery("{} | avg_over_time(foo)")
	assert.True(t, result)
}

func TestQueryWithSumOverTimeFunction_ReturnsTrue(t *testing.T) {
	result := isMetricsQuery("{} | sum_over_time(foo)")
	assert.True(t, result)
}

func TestQueryWithCountOverTimeFunction_ReturnsTrue(t *testing.T) {
	result := isMetricsQuery("{} | count_over_time(foo)")
	assert.True(t, result)
}

func TestQueryWithMaxOverTimeFunction_ReturnsTrue(t *testing.T) {
	result := isMetricsQuery("{} | max_over_time(foo)")
	assert.True(t, result)
}

func TestQueryWithMinOverTimeFunction_ReturnsTrue(t *testing.T) {
	result := isMetricsQuery("{} | min_over_time(foo)")
	assert.True(t, result)
}

func TestQueryWithQuantileOverTimeFunction_ReturnsTrue(t *testing.T) {
	result := isMetricsQuery("{} | quantile_over_time(foo)")
	assert.True(t, result)
}

func TestQueryWithHistogramOverTimeFunction_ReturnsTrue(t *testing.T) {
	result := isMetricsQuery("{} | histogram_over_time(foo)")
	assert.True(t, result)
}

func TestQueryWithCompareFunction_ReturnsTrue(t *testing.T) {
	result := isMetricsQuery("{} | compare(foo)")
	assert.True(t, result)
}

func TestQueryWithMultipleFunctions_ReturnsTrue(t *testing.T) {
	result := isMetricsQuery("{} | rate(foo) | avg_over_time(bar)")
	assert.True(t, result)
}

func TestQueryWithInvalidFunction_ReturnsFalse(t *testing.T) {
	result := isMetricsQuery("{} | invalid_function(foo)")
	assert.False(t, result)
}
