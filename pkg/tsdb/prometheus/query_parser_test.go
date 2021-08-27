package prometheus

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var now = time.Now()

func TestPrometheusQueryParser_calculateStep(t *testing.T) {
	calculator := tsdb.NewCalculator(tsdb.CalculatorOptions{})
	expr := "test"
	timeRange := backend.TimeRange{
		From: now,
		To:   now.Add(12 * time.Hour),
	}

	dsInfo := &DatasourceInfo{}
	testCases := []struct {
		name     string
		model    QueryModel
		query    backend.DataQuery
		expected time.Duration
	}{
		{"Interval: nil, StepMode: nil, IsBackendQuery: false", QueryModel{Expr: expr, Interval: "", StepMode: "", IsBackendQuery: false}, backend.DataQuery{RefID: "A", QueryType: "", MaxDataPoints: int64(1), Interval: 15, TimeRange: timeRange}, time.Duration(30) * time.Second},
		{"Interval: 15s, StepMode: min, IsBackendQuery: false", QueryModel{Expr: expr, Interval: "15s", StepMode: "min", IsBackendQuery: false}, backend.DataQuery{RefID: "A", QueryType: "", MaxDataPoints: int64(1), Interval: 15, TimeRange: timeRange}, time.Duration(30) * time.Second},
		{"Interval: 15s, StepMode: min, IsBackendQuery: true", QueryModel{Expr: expr, Interval: "15s", StepMode: "min", IsBackendQuery: true}, backend.DataQuery{RefID: "A", QueryType: "", MaxDataPoints: int64(1), Interval: 15, TimeRange: timeRange}, time.Duration(15) * time.Second},
		{"Interval: 7s, StepMode: exact, IsBackendQuery: false", QueryModel{Expr: expr, Interval: "7s", StepMode: "exact", IsBackendQuery: false}, backend.DataQuery{RefID: "A", QueryType: "", MaxDataPoints: int64(1), Interval: 15, TimeRange: timeRange}, time.Duration(7) * time.Second},
		{"Interval: 7s, StepMode: exact, IsBackendQuery: true", QueryModel{Expr: expr, Interval: "7s", StepMode: "exact", IsBackendQuery: true}, backend.DataQuery{RefID: "A", QueryType: "", MaxDataPoints: int64(1), Interval: 15, TimeRange: timeRange}, time.Duration(7) * time.Second},
		{"Interval: 6s, StepMode: max, IsBackendQuery: false", QueryModel{Expr: expr, Interval: "6s", StepMode: "max", IsBackendQuery: false}, backend.DataQuery{RefID: "A", QueryType: "", MaxDataPoints: int64(1), Interval: 15, TimeRange: timeRange}, time.Duration(6) * time.Second},
		{"Interval: 6s, StepMode: max, IsBackendQuery: true", QueryModel{Expr: expr, Interval: "6s", StepMode: "max", IsBackendQuery: true}, backend.DataQuery{RefID: "A", QueryType: "", MaxDataPoints: int64(1), Interval: 15, TimeRange: timeRange}, time.Duration(6) * time.Second},
		{"Interval: 100s, StepMode: max, IsBackendQuery: false", QueryModel{Expr: expr, Interval: "100s", StepMode: "max", IsBackendQuery: false}, backend.DataQuery{RefID: "A", QueryType: "", MaxDataPoints: int64(1), Interval: 15, TimeRange: timeRange}, time.Duration(30) * time.Second},
		{"Interval: 100s, StepMode: max, IsBackendQuery: true", QueryModel{Expr: expr, Interval: "100s", StepMode: "max", IsBackendQuery: true}, backend.DataQuery{RefID: "A", QueryType: "", MaxDataPoints: int64(1), Interval: 15, TimeRange: timeRange}, time.Duration(100) * time.Second},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			step, err := createStep(dsInfo, &tc.model, tc.query, calculator)
			require.Nil(t, err)
			assert.Equal(t, tc.expected, step)
		})
	}
}

func TestPrometheusQueryParser_parseQuery(t *testing.T) {
	service := Service{
		intervalCalculator: tsdb.NewCalculator(),
	}

	t.Run("parsing query model with step and default stepMode", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"refId": "A"
		}`, timeRange)

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(dsInfo, query)
		require.NoError(t, err)
		require.Equal(t, time.Second*30, models[0].Step)
	})

	t.Run("parsing query model with step and exact stepMode", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"refId": "A",
			"stepMode": "exact",
			"interval": "7s"
		}`, timeRange)

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(dsInfo, query)
		require.NoError(t, err)
		require.Equal(t, time.Second*7, models[0].Step)
	})

	t.Run("parsing query model with short step and max stepMode", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"refId": "A",
			"stepMode": "max",
			"interval": "6s"
		}`, timeRange)

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(dsInfo, query)
		require.NoError(t, err)
		require.Equal(t, time.Second*6, models[0].Step)
	})

	t.Run("parsing query model with long step and max stepMode", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"refId": "A",
			"stepMode": "max",
			"interval": "100s"
		}`, timeRange)

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(dsInfo, query)
		require.NoError(t, err)
		require.Equal(t, time.Second*30, models[0].Step)
	})

	t.Run("parsing query model with unsafe interval", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"refId": "A",
			"stepMode": "max",
			"interval": "2s"
		}`, timeRange)

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(dsInfo, query)
		require.NoError(t, err)
		require.Equal(t, time.Second*5, models[0].Step)
	})

	t.Run("parsing query model without step parameter", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(1 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(dsInfo, query)
		require.NoError(t, err)
		require.Equal(t, time.Second*15, models[0].Step)
	})

	t.Run("parsing query model with high intervalFactor", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 10,
			"refId": "A"
		}`, timeRange)

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(dsInfo, query)
		require.NoError(t, err)
		require.Equal(t, time.Minute*20, models[0].Step)
	})

	t.Run("parsing query model with low intervalFactor", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(dsInfo, query)
		require.NoError(t, err)
		require.Equal(t, time.Minute*2, models[0].Step)
	})

	t.Run("parsing query model specified scrape-interval in the data source", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		dsInfo := &DatasourceInfo{
			TimeInterval: "240s",
		}
		models, err := service.parseQuery(dsInfo, query)
		require.NoError(t, err)
		require.Equal(t, time.Minute*4, models[0].Step)
	})

	t.Run("parsing query model of instant query", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A",
			"instant": true
		}`, timeRange)

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(dsInfo, query)
		require.NoError(t, err)
		require.Equal(t, Instant, models[0].QueryType)
	})

	t.Run("parsing query model of range query", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A",
			"range": true
		}`, timeRange)

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(dsInfo, query)
		require.NoError(t, err)
		require.Equal(t, Range, models[0].QueryType)
	})
}

func queryContext(json string, timeRange backend.TimeRange) *backend.QueryDataRequest {
	return &backend.QueryDataRequest{
		Queries: []backend.DataQuery{
			{
				JSON:      []byte(json),
				TimeRange: timeRange,
				RefID:     "A",
			},
		},
	}
}
