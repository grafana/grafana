package loki

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestFormatName(t *testing.T) {
	t.Run("converting metric name", func(t *testing.T) {
		metric := map[string]string{
			"app":    "backend",
			"device": "mobile",
		}

		query := &lokiQuery{
			LegendFormat: "legend {{app}} {{ device }} {{broken}}",
		}

		require.Equal(t, "legend backend mobile ", formatName(metric, query))
	})

	t.Run("build full series name", func(t *testing.T) {
		metric := map[string]string{
			"app":    "backend",
			"device": "mobile",
		}

		query := &lokiQuery{
			LegendFormat: "",
		}

		require.Equal(t, `{app="backend", device="mobile"}`, formatName(metric, query))
	})
}

func TestAdjustFrame(t *testing.T) {
	t.Run("response should be parsed normally", func(t *testing.T) {
		field1 := data.NewField("", nil, make([]time.Time, 0))
		field2 := data.NewField("", nil, make([]float64, 0))
		field2.Labels = data.Labels{"app": "Application", "tag2": "tag2"}

		frame := data.NewFrame("test", field1, field2)
		frame.SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMany})

		query := &lokiQuery{
			Expr:         "up(ALERTS)",
			QueryType:    QueryTypeRange,
			LegendFormat: "legend {{app}}",
			Step:         time.Second * 42,
		}

		adjustFrame(frame, query)

		require.Equal(t, frame.Name, "legend Application")
		require.Equal(t, frame.Meta.ExecutedQueryString, "Expr: up(ALERTS)\nStep: 42s")
		require.Equal(t, frame.Fields[0].Config.Interval, float64(42000))
		require.Equal(t, frame.Fields[1].Config.DisplayNameFromDS, "legend Application")
	})

	t.Run("should set interval-attribute in response", func(t *testing.T) {
		query := &lokiQuery{
			Step:      time.Second * 42,
			QueryType: QueryTypeRange,
		}

		field1 := data.NewField("", nil, make([]time.Time, 0))
		field2 := data.NewField("", nil, make([]float64, 0))

		frame := data.NewFrame("test", field1, field2)
		frame.SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMany})

		adjustFrame(frame, query)

		// to keep the test simple, we assume the
		// first field is the time-field
		timeField := frame.Fields[0]
		require.NotNil(t, timeField)
		require.Equal(t, data.FieldTypeTime, timeField.Type())

		timeFieldConfig := timeField.Config
		require.NotNil(t, timeFieldConfig)
		require.Equal(t, float64(42000), timeFieldConfig.Interval)
	})
}
