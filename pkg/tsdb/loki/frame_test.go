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
	t.Run("logs-frame metadata should be set correctly", func(t *testing.T) {
		frame := data.NewFrame("",
			data.NewField("labels", nil, []string{
				`{"level":"info"}`,
				`{"level":"error"}`,
				`{"level":"error"}`,
				`{"level":"info"}`,
			}),
			data.NewField("time", nil, []time.Time{
				time.Date(2022, 1, 2, 3, 4, 5, 6, time.UTC),
				time.Date(2022, 1, 2, 3, 5, 5, 6, time.UTC),
				time.Date(2022, 1, 2, 3, 5, 5, 6, time.UTC),
				time.Date(2022, 1, 2, 3, 6, 5, 6, time.UTC),
			}),
			data.NewField("line", nil, []string{"line1", "line2", "line2", "line3"}),
		)

		frame.RefID = "A"

		query := &lokiQuery{
			Expr:      `{type="important"}`,
			QueryType: QueryTypeRange,
		}

		err := adjustFrame(frame, query)
		require.NoError(t, err)

		fields := frame.Fields

		require.Equal(t, 5, len(fields))
		tsNsField := fields[3]
		require.Equal(t, "tsNs", tsNsField.Name)
		require.Equal(t, data.FieldTypeString, tsNsField.Type())
		require.Equal(t, 4, tsNsField.Len())
		require.Equal(t, "1641092645000000006", tsNsField.At(0))
		require.Equal(t, "1641092705000000006", tsNsField.At(1))
		require.Equal(t, "1641092705000000006", tsNsField.At(2))
		require.Equal(t, "1641092765000000006", tsNsField.At(3))

		idField := fields[4]
		require.Equal(t, "id", idField.Name)
		require.Equal(t, data.FieldTypeString, idField.Type())
		require.Equal(t, 4, idField.Len())
		require.Equal(t, "1641092645000000006_a36f4e1b_A", idField.At(0))
		require.Equal(t, "1641092705000000006_1d77c9ca_A", idField.At(1))
		require.Equal(t, "1641092705000000006_1d77c9ca_1_A", idField.At(2))
		require.Equal(t, "1641092765000000006_948c1a7d_A", idField.At(3))
	})

	t.Run("logs-frame id and string-time fields should be created", func(t *testing.T) {
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

		err := adjustFrame(frame, query)
		require.NoError(t, err)

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

		err := adjustFrame(frame, query)
		require.NoError(t, err)

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
