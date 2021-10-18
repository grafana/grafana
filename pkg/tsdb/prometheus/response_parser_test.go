package prometheus

import (
	"testing"
	"time"

	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
	p "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestPrometheus_parseResponse(t *testing.T) {
	t.Run("exemplars response should be sampled and parsed normally", func(t *testing.T) {
		value := make(map[PrometheusQueryType]interface{})
		exemplars := []apiv1.ExemplarQueryResult{
			{
				SeriesLabels: p.LabelSet{
					"__name__": "tns_request_duration_seconds_bucket",
					"instance": "app:80",
					"job":      "tns/app",
				},
				Exemplars: []apiv1.Exemplar{
					{
						Labels:    p.LabelSet{"traceID": "test1"},
						Value:     0.003535405,
						Timestamp: p.TimeFromUnixNano(time.Now().Add(-2 * time.Minute).UnixNano()),
					},
					{
						Labels:    p.LabelSet{"traceID": "test2"},
						Value:     0.005555605,
						Timestamp: p.TimeFromUnixNano(time.Now().Add(-4 * time.Minute).UnixNano()),
					},
					{
						Labels:    p.LabelSet{"traceID": "test3"},
						Value:     0.007545445,
						Timestamp: p.TimeFromUnixNano(time.Now().Add(-6 * time.Minute).UnixNano()),
					},
					{
						Labels:    p.LabelSet{"traceID": "test4"},
						Value:     0.009545445,
						Timestamp: p.TimeFromUnixNano(time.Now().Add(-7 * time.Minute).UnixNano()),
					},
				},
			},
		}

		value[ExemplarQueryType] = exemplars
		query := &PrometheusQuery{
			LegendFormat: "legend {{app}}",
		}
		res, err := parseResponse(value, query)
		require.NoError(t, err)

		// Test fields
		require.Len(t, res, 1)
		require.Equal(t, res[0].Name, "exemplar")
		require.Equal(t, res[0].Fields[0].Name, "Time")
		require.Equal(t, res[0].Fields[1].Name, "Value")
		require.Len(t, res[0].Fields, 6)

		// Test correct values (sampled to 2)
		require.Equal(t, res[0].Fields[1].Len(), 2)
		require.Equal(t, res[0].Fields[1].At(0), 0.009545445)
		require.Equal(t, res[0].Fields[1].At(1), 0.003535405)
	})

	t.Run("matrix response should be parsed normally", func(t *testing.T) {
		values := []p.SamplePair{
			{Value: 1, Timestamp: 1000},
			{Value: 2, Timestamp: 2000},
			{Value: 3, Timestamp: 3000},
			{Value: 4, Timestamp: 4000},
			{Value: 5, Timestamp: 5000},
		}
		value := make(map[PrometheusQueryType]interface{})
		value[RangeQueryType] = p.Matrix{
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
		value := make(map[PrometheusQueryType]interface{})
		value[RangeQueryType] = p.Vector{
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
		value := make(map[PrometheusQueryType]interface{})
		value[RangeQueryType] = &p.Scalar{
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
}
