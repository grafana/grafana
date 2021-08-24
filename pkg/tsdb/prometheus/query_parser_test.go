package prometheus

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/require"
)

var now = time.Now()

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
