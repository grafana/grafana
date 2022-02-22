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

func TestParseResponse(t *testing.T) {
	t.Run("value is not of supported type", func(t *testing.T) {
		value := loghttp.QueryResponse{
			Data: loghttp.QueryResponseData{
				Result: loghttp.Scalar{},
			},
		}
		res, err := parseResponse(&value, nil)
		require.Equal(t, len(res), 0)
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
			Expr:         "up(ALERTS)",
			QueryType:    QueryTypeRange,
			LegendFormat: "legend {{app}}",
			Step:         time.Second * 42,
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
		field1.Config = &data.FieldConfig{Interval: float64(42000)}
		field2 := data.NewField("value", labels, []float64{1, 2, 3, 4, 5})
		field2.SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend Application"})
		testFrame := data.NewFrame("legend Application", field1, field2)
		testFrame.SetMeta(&data.FrameMeta{
			ExecutedQueryString: "Expr: up(ALERTS)\nStep: 42s",
		})

		if diff := cmp.Diff(testFrame, frame[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("should set interval-attribute in response", func(t *testing.T) {
		values := []p.SamplePair{
			{Value: 1, Timestamp: 1000},
		}
		value := loghttp.QueryResponse{
			Data: loghttp.QueryResponseData{
				Result: loghttp.Matrix{
					p.SampleStream{
						Values: values,
					},
				},
			},
		}

		query := &lokiQuery{
			Step:      time.Second * 42,
			QueryType: QueryTypeRange,
		}

		frames, err := parseResponse(&value, query)
		require.NoError(t, err)

		// to keep the test simple, we assume the
		// first field is the time-field
		timeField := frames[0].Fields[0]
		require.NotNil(t, timeField)
		require.Equal(t, data.FieldTypeTime, timeField.Type())

		timeFieldConfig := timeField.Config
		require.NotNil(t, timeFieldConfig)
		require.Equal(t, float64(42000), timeFieldConfig.Interval)
	})
}
