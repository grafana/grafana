package prometheus

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	p "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestParseResponse(t *testing.T) {
	t.Run("value is not of type matrix, vector or scalar", func(t *testing.T) {
		queryRes := data.Frames{}
		value := p.Vector{}
		res, err := parseResponse(value, nil)

		require.Equal(t, queryRes, res)
		require.Error(t, err, nil)
	})

	t.Run("matrix response should be parsed normally", func(t *testing.T) {
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
		require.Equal(t, res[0].Fields[0].Name, "Time")
		require.Len(t, res[0].Fields[1].Labels, 2)
		require.Equal(t, res[0].Fields[1].Labels.String(), "app=Application, tag2=tag2")
		require.Equal(t, res[0].Fields[1].Name, "Value")
		require.Equal(t, res[0].Fields[1].Config.DisplayNameFromDS, "legend Application")

		// Ensure the timestamps are UTC zoned
		testValue := res[0].Fields[0].At(0)
		require.Equal(t, "UTC", testValue.(time.Time).Location().String())
	})

	t.Run("vector response should be parsed normally", func(t *testing.T) {
		value := p.Vector{
			&p.Sample{
				Metric:    p.Metric{"app": "Application", "tag2": "tag2"},
				Value:     1,
				Timestamp: 1000,
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
		require.Equal(t, res[0].Fields[0].Name, "Time")
		require.Len(t, res[0].Fields[1].Labels, 2)
		require.Equal(t, res[0].Fields[1].Labels.String(), "app=Application, tag2=tag2")
		require.Equal(t, res[0].Fields[1].Name, "Value")
		require.Equal(t, res[0].Fields[1].Config.DisplayNameFromDS, "legend Application")

		// Ensure the timestamps are UTC zoned
		testValue := res[0].Fields[0].At(0)
		require.Equal(t, "UTC", testValue.(time.Time).Location().String())
	})

	t.Run("scalar response should be parsed normally", func(t *testing.T) {
		value := &p.Scalar{
			Value:     1,
			Timestamp: 1000,
		}
		query := &PrometheusQuery{}
		res, err := parseResponse(value, query)
		require.NoError(t, err)

		require.Len(t, res, 1)
		require.Equal(t, res[0].Name, "1")
		require.Len(t, res[0].Fields, 2)
		require.Len(t, res[0].Fields[0].Labels, 0)
		require.Equal(t, res[0].Fields[0].Name, "Time")
		require.Equal(t, res[0].Fields[1].Name, "Value")
		require.Equal(t, res[0].Fields[1].Config.DisplayNameFromDS, "1")

		// Ensure the timestamps are UTC zoned
		testValue := res[0].Fields[0].At(0)
		require.Equal(t, "UTC", testValue.(time.Time).Location().String())
	})

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
}
