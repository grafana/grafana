package query

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
)

func TestPerformComparison(t *testing.T) {
	b := QueryAPIBuilder{
		log:               log.New(),
		passiveModeClient: nil,
	}

	t.Run("do not run if comparison mode is off", func(t *testing.T) {
		assert.False(t, b.peformComparison(datasourceRequest{}))
	})

	var s DataSourceClientSupplier = (*CommonDataSourceClientSupplier)(nil)
	b.passiveModeClient = &s

	t.Run("do not run relative time ranges", func(t *testing.T) {
		assert.False(t, b.peformComparison(datasourceRequest{
			PluginId: "loki",
			Request: &v0alpha1.QueryDataRequest{
				TimeRange: v0alpha1.TimeRange{
					From: "now - 1h",
					To:   "now",
				},
			},
		}))
	})

	t.Run("do not run for other datasources", func(t *testing.T) {
		assert.False(t, b.peformComparison(datasourceRequest{
			PluginId: "grafana-bigquery-datasources",
			Request: &v0alpha1.QueryDataRequest{
				TimeRange: v0alpha1.TimeRange{
					From: "1718348400000",
					To:   "1718348400000",
				},
			},
		}))
	})

	t.Run("run absolute time ranges for loki and prometheus", func(t *testing.T) {
		assert.True(t, b.peformComparison(datasourceRequest{
			PluginId: "loki",
			Request: &v0alpha1.QueryDataRequest{
				TimeRange: v0alpha1.TimeRange{
					From: "1718348400000",
					To:   "1718348400000",
				},
			},
		}))
		assert.True(t, b.peformComparison(datasourceRequest{
			PluginId: "prometheus",
			Request: &v0alpha1.QueryDataRequest{
				TimeRange: v0alpha1.TimeRange{
					From: "1718348400000",
					To:   "1718348400000",
				},
			},
		}))
	})
}

func TestCompareResults(t *testing.T) {
	r := prometheus.NewRegistry()
	b := QueryAPIBuilder{
		log:     log.New(),
		tracer:  tracing.InitializeTracerForTest(),
		metrics: newQueryMetrics(r),
	}

	prometheusResp := backend.QueryDataResponse{
		Responses: map[string]backend.DataResponse{
			"A": {
				Status: 200,
				Frames: []*data.Frame{
					{
						Name: "Value",
						Fields: []*data.Field{
							data.NewField("Time", nil, []time.Time{time.Unix(1, 0)}),
							data.NewField("grafana_feature_toggles_info", map[string]string{
								"__name__": "grafana_feature_toggles_info",
								"slug":     "foo",
							}, []uint8{1, 2}),
						},
						RefID: "A",
						Meta: &data.FrameMeta{
							Type: "timeseries-multi",
						},
					},
				},
			},
		},
	}

	t.Run("equal, but fields are in different orders", func(t *testing.T) {
		// same but the fields orders are different
		prometheusRespSame := backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {
					Status: 200,
					Frames: []*data.Frame{
						{
							Name: "Value",
							Fields: []*data.Field{
								data.NewField("grafana_feature_toggles_info", map[string]string{
									"__name__": "grafana_feature_toggles_info",
									"slug":     "foo",
								}, []uint8{1, 2}),
								data.NewField("Time", nil, []time.Time{time.Unix(1, 0)}),
							},
							RefID: "A",
							Meta: &data.FrameMeta{
								Type: "timeseries-multi",
							},
						},
					},
				},
			},
		}
		assert.True(t, b.compareResults("prometheus", &prometheusResp, &prometheusRespSame))
	})
	t.Run("field names differ", func(t *testing.T) {
		prometheusRespDiff := backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {
					Status: 200,
					Frames: []*data.Frame{
						{
							Name: "Value",
							Fields: []*data.Field{
								data.NewField("Time", nil, []time.Time{time.Unix(1, 0)}),
								data.NewField("Value", map[string]string{
									"__name__": "grafana_feature_toggles_info",
									"slug":     "foo",
								}, []uint8{1, 2}),
							},
							RefID: "A",
							Meta: &data.FrameMeta{
								Type: "timeseries-multi",
							},
						},
					},
				},
			},
		}
		assert.False(t, b.compareResults("prometheus", &prometheusResp, &prometheusRespDiff))
	})
}
