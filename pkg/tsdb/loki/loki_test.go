package loki

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
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
