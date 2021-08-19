package loki

import (
	"fmt"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/loki/pkg/loghttp"
	p "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestLoki(t *testing.T) {
	t.Run("converting metric name", func(t *testing.T) {
		metric := map[p.LabelName]p.LabelValue{
			p.LabelName("app"):    p.LabelValue("backend"),
			p.LabelName("device"): p.LabelValue("mobile"),
		}

		query := &lokiQuery{
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

		query := &lokiQuery{
			LegendFormat: "",
		}

		require.Equal(t, `http_request_total{app="backend", device="mobile"}`, formatLegend(metric, query))
	})

	t.Run("parsing query model with step", func(t *testing.T) {
		queryContext := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					JSON: []byte(`
					{
						"expr": "go_goroutines",
						"format": "time_series",
						"refId": "A"
					}`,
					),
					TimeRange: backend.TimeRange{
						From: time.Now().Add(-30 * time.Second),
						To:   time.Now(),
					},
				},
			},
		}
		service := &Service{
			intervalCalculator: mockCalculator{
				interval: tsdb.Interval{
					Value: time.Second * 30,
				},
			},
		}
		dsInfo := &datasourceInfo{}
		models, err := service.parseQuery(dsInfo, queryContext)
		require.NoError(t, err)
		require.Equal(t, time.Second*30, models[0].Step)
	})

	t.Run("parsing query model without step parameter", func(t *testing.T) {
		queryContext := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					JSON: []byte(`
					{
						"expr": "go_goroutines",
						"format": "time_series",
						"refId": "A"
					}`,
					),
					TimeRange: backend.TimeRange{
						From: time.Now().Add(-48 * time.Hour),
						To:   time.Now(),
					},
				},
			},
		}
		service := &Service{
			intervalCalculator: mockCalculator{
				interval: tsdb.Interval{
					Value: time.Minute * 2,
				},
			},
		}
		dsInfo := &datasourceInfo{}
		models, err := service.parseQuery(dsInfo, queryContext)
		require.NoError(t, err)
		require.Equal(t, time.Minute*2, models[0].Step)

		service = &Service{
			intervalCalculator: mockCalculator{
				interval: tsdb.Interval{
					Value: time.Second * 2,
				},
			},
		}
		models, err = service.parseQuery(dsInfo, queryContext)
		require.NoError(t, err)
		fmt.Println(models)
		require.Equal(t, time.Second*2, models[0].Step)
	})
}

func TestParseResponse(t *testing.T) {
	t.Run("value is not of type matrix", func(t *testing.T) {
		queryRes := data.Frames{}
		value := loghttp.QueryResponse{
			Data: loghttp.QueryResponseData{
				Result: loghttp.Vector{},
			},
		}
		res, err := parseResponse(&value, nil)
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
		value := loghttp.QueryResponse{
			Data: loghttp.QueryResponseData{
				Result: loghttp.Matrix{
					p.SampleStream{
						Metric: p.Metric{"app": "Application", "tag2": "tag2"},
						Values: values,
					},
				},
			},
		}

		query := &lokiQuery{
			LegendFormat: "legend {{app}}",
		}
		frame, err := parseResponse(&value, query)
		require.NoError(t, err)

		labels, err := data.LabelsFromString("app=Application, tag2=tag2")
		require.NoError(t, err)
		field1 := data.NewField("time", nil, []time.Time{
			time.Date(1970, 1, 1, 0, 0, 1, 0, time.UTC),
			time.Date(1970, 1, 1, 0, 0, 2, 0, time.UTC),
			time.Date(1970, 1, 1, 0, 0, 3, 0, time.UTC),
			time.Date(1970, 1, 1, 0, 0, 4, 0, time.UTC),
			time.Date(1970, 1, 1, 0, 0, 5, 0, time.UTC),
		})
		field2 := data.NewField("value", labels, []float64{1, 2, 3, 4, 5})
		field2.SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend Application"})
		testFrame := data.NewFrame("legend Application", field1, field2)

		if diff := cmp.Diff(testFrame, frame[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})
}

type mockCalculator struct {
	interval tsdb.Interval
}

func (m mockCalculator) Calculate(timerange backend.TimeRange, minInterval time.Duration, intervalMode tsdb.IntervalMode) (tsdb.Interval, error) {
	return m.interval, nil
}

func (m mockCalculator) CalculateSafeInterval(timerange backend.TimeRange, resolution int64) tsdb.Interval {
	return m.interval
}
