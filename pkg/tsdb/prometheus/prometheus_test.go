package prometheus

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb"
	p "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

var now = time.Now()

func TestPrometheus(t *testing.T) {
	service := Service{
		intervalCalculator: tsdb.NewCalculator(),
	}

	t.Run("converting metric name", func(t *testing.T) {
		metric := map[p.LabelName]p.LabelValue{
			p.LabelName("app"):    p.LabelValue("backend"),
			p.LabelName("device"): p.LabelValue("mobile"),
		}

		query := &PrometheusQuery{
			LegendFormat: "legend {{app}} {{ device }} {{broken}}",
		}

		require.Equal(t, "legend backend mobile ", formatLegend(metric, query))
	})

	t.Run("build full series name", func(t *testing.T) {
		metric := map[p.LabelName]p.LabelValue{
			p.LabelName(p.MetricNameLabel): p.LabelValue("http_request_total"),
			p.LabelName("app"):             p.LabelValue("backend"),
			p.LabelName("device"):          p.LabelValue("mobile"),
		}

		query := &PrometheusQuery{
			LegendFormat: "",
		}

		require.Equal(t, `http_request_total{app="backend", device="mobile"}`, formatLegend(metric, query))
	})

	t.Run("parsing query model with step and default stepMode", func(t *testing.T) {
		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"refId": "A"
		}`)
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}
		query.TimeRange = timeRange
		models, err := service.parseQuery([]backend.DataQuery{query}, &DatasourceInfo{})
		require.NoError(t, err)
		require.Equal(t, time.Second*30, models[0].Step)
	})

	t.Run("parsing query model with step and exact stepMode", func(t *testing.T) {
		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"refId": "A",
			"stepMode": "exact",
			"interval": "7s"
		}`)
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}
		query.TimeRange = timeRange
		models, err := service.parseQuery([]backend.DataQuery{query}, &DatasourceInfo{})
		require.NoError(t, err)
		require.Equal(t, time.Second*7, models[0].Step)
	})

	t.Run("parsing query model with short step and max stepMode", func(t *testing.T) {
		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"refId": "A",
			"stepMode": "max",
			"interval": "6s"
		}`)
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}
		query.TimeRange = timeRange
		models, err := service.parseQuery([]backend.DataQuery{query}, &DatasourceInfo{})
		require.NoError(t, err)
		require.Equal(t, time.Second*6, models[0].Step)
	})

	t.Run("parsing query model with long step and max stepMode", func(t *testing.T) {
		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"refId": "A",
			"stepMode": "max",
			"interval": "100s"
		}`)
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}
		query.TimeRange = timeRange
		models, err := service.parseQuery([]backend.DataQuery{query}, &DatasourceInfo{})
		require.NoError(t, err)
		require.Equal(t, time.Second*30, models[0].Step)
	})

	t.Run("parsing query model with unsafe interval", func(t *testing.T) {
		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"refId": "A",
			"stepMode": "max",
			"interval": "2s"
		}`)
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}
		query.TimeRange = timeRange
		models, err := service.parseQuery([]backend.DataQuery{query}, &DatasourceInfo{})
		require.NoError(t, err)
		require.Equal(t, time.Second*5, models[0].Step)
	})

	t.Run("parsing query model without step parameter", func(t *testing.T) {
		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`)
		models, err := service.parseQuery([]backend.DataQuery{query}, &DatasourceInfo{})
		require.NoError(t, err)
		require.Equal(t, time.Minute*2, models[0].Step)

		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(1 * time.Hour),
		}
		query.TimeRange = timeRange
		models, err = service.parseQuery([]backend.DataQuery{query}, &DatasourceInfo{})
		require.NoError(t, err)
		require.Equal(t, time.Second*15, models[0].Step)
	})

	t.Run("parsing query model with high intervalFactor", func(t *testing.T) {
		models, err := service.parseQuery([]backend.DataQuery{queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 10,
			"refId": "A"
		}`)}, &DatasourceInfo{})
		require.NoError(t, err)
		require.Equal(t, time.Minute*20, models[0].Step)
	})

	t.Run("parsing query model with low intervalFactor", func(t *testing.T) {
		models, err := service.parseQuery([]backend.DataQuery{queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`)}, &DatasourceInfo{})
		require.NoError(t, err)
		require.Equal(t, time.Minute*2, models[0].Step)
	})

	t.Run("parsing query model specified scrape-interval in the data source", func(t *testing.T) {
		models, err := service.parseQuery([]backend.DataQuery{queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`)}, &DatasourceInfo{
			TimeInterval: "240s",
		})
		require.NoError(t, err)
		require.Equal(t, time.Minute*4, models[0].Step)
	})
}

func queryContext(json string) backend.DataQuery {
	timeRange := backend.TimeRange{
		From: now,
		To:   now.Add(48 * time.Hour),
	}
	return backend.DataQuery{
		TimeRange: timeRange,
		RefID:     "A",
		JSON:      []byte(json),
	}
}

func TestParseResponse(t *testing.T) {
	t.Run("value is not of type matrix", func(t *testing.T) {
		//nolint: staticcheck // plugins.DataQueryResult deprecated
		queryRes := data.Frames{}
		value := p.Vector{}
		res, err := parseResponse(value, nil)

		require.Equal(t, queryRes, res)
		require.Error(t, err)
	})

	t.Run("response should be parsed normally", func(t *testing.T) {
		values := []p.SamplePair{
			{Value: 1, Timestamp: 1000},
			{Value: 2, Timestamp: 2000},
			{Value: 3, Timestamp: 3000},
			{Value: 4, Timestamp: 4000},
			{Value: 5, Timestamp: 5000},
		}
		value := p.Matrix{
			&p.SampleStream{
				Metric: p.Metric{"app": "Application", "tag2": "tag2"},
				Values: values,
			},
		}
		query := &PrometheusQuery{
			LegendFormat: "legend {{app}}",
		}
		res, err := parseResponse(value, query)
		require.NoError(t, err)

		require.Len(t, res, 1)
		require.Equal(t, res[0].Name, "legend Application")
		require.Len(t, res[0].Fields, 2)
		require.Len(t, res[0].Fields[0].Labels, 0)
		require.Equal(t, res[0].Fields[0].Name, "time")
		require.Len(t, res[0].Fields[1].Labels, 2)
		require.Equal(t, res[0].Fields[1].Labels.String(), "app=Application, tag2=tag2")
		require.Equal(t, res[0].Fields[1].Name, "value")
		require.Equal(t, res[0].Fields[1].Config.DisplayNameFromDS, "legend Application")

		// Ensure the timestamps are UTC zoned
		testValue := res[0].Fields[0].At(0)
		require.Equal(t, "UTC", testValue.(time.Time).Location().String())
	})
}
