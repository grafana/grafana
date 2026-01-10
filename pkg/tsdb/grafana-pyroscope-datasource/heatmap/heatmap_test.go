package heatmap

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestCreateHeatmapFrame(t *testing.T) {
	t.Run("creates frame with correct metadata", func(t *testing.T) {
		points := []*Point{
			{
				Timestamp: time.Now().UnixMilli(),
				YMin:      []float64{0, 100, 200},
				Counts:    []int64{5, 10, 3},
			},
		}
		labels := map[string]string{"service": "api"}

		frame := CreateHeatmapFrame(labels, points, "ns")

		require.NotNil(t, frame)
		require.Equal(t, "heatmap", frame.Name)
		require.NotNil(t, frame.Meta)
		require.Equal(t, data.FrameType("heatmap-cells"), frame.Meta.Type)
	})

	t.Run("creates correct fields structure", func(t *testing.T) {
		timestamp := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		points := []*Point{
			{
				Timestamp: timestamp.UnixMilli(),
				YMin:      []float64{0, 100, 200},
				Counts:    []int64{5, 10, 3},
			},
		}

		frame := CreateHeatmapFrame(map[string]string{}, points, "ns")

		require.Len(t, frame.Fields, 5)
		require.Equal(t, "xMax", frame.Fields[0].Name)
		require.Equal(t, "yMin", frame.Fields[1].Name)
		require.Equal(t, "yMax", frame.Fields[2].Name)
		require.Equal(t, "count", frame.Fields[3].Name)
		require.Equal(t, "yLayout", frame.Fields[4].Name)
	})

	t.Run("correctly expands multiple time points into cells", func(t *testing.T) {
		timestamp1 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		timestamp2 := time.Date(2024, 1, 1, 0, 1, 0, 0, time.UTC)

		points := []*Point{
			{
				Timestamp: timestamp1.UnixMilli(),
				YMin:      []float64{0, 100},
				Counts:    []int64{5, 10},
			},
			{
				Timestamp: timestamp2.UnixMilli(),
				YMin:      []float64{0, 100},
				Counts:    []int64{7, 12},
			},
		}

		frame := CreateHeatmapFrame(map[string]string{}, points, "ns")

		// Should create 4 cells total (2 time points × 2 buckets)
		require.Equal(t, 4, frame.Fields[0].Len())
		require.Equal(t, 4, frame.Fields[1].Len())
		require.Equal(t, 4, frame.Fields[2].Len())
		require.Equal(t, 4, frame.Fields[3].Len())
		require.Equal(t, 4, frame.Fields[4].Len())

		// Check xMax values (timestamps) - compare Unix millis to avoid timezone issues
		xMaxField := frame.Fields[0]
		require.Equal(t, timestamp1.UnixMilli(), xMaxField.At(0).(time.Time).UnixMilli())
		require.Equal(t, timestamp1.UnixMilli(), xMaxField.At(1).(time.Time).UnixMilli())
		require.Equal(t, timestamp2.UnixMilli(), xMaxField.At(2).(time.Time).UnixMilli())
		require.Equal(t, timestamp2.UnixMilli(), xMaxField.At(3).(time.Time).UnixMilli())

		// Check yMin values (bucket minimums)
		yMinField := frame.Fields[1]
		require.Equal(t, float64(0), yMinField.At(0))
		require.Equal(t, float64(100), yMinField.At(1))
		require.Equal(t, float64(0), yMinField.At(2))
		require.Equal(t, float64(100), yMinField.At(3))

		// Check yMax values (bucket maximums)
		yMaxField := frame.Fields[2]
		require.Equal(t, float64(100), yMaxField.At(0)) // yMax for bucket [0-100)
		require.Equal(t, float64(200), yMaxField.At(1)) // yMax for bucket [100-200)
		require.Equal(t, float64(100), yMaxField.At(2)) // yMax for bucket [0-100)
		require.Equal(t, float64(200), yMaxField.At(3)) // yMax for bucket [100-200)

		// Check count values
		countField := frame.Fields[3]
		require.Equal(t, int64(5), countField.At(0))
		require.Equal(t, int64(10), countField.At(1))
		require.Equal(t, int64(7), countField.At(2))
		require.Equal(t, int64(12), countField.At(3))

		// Check yLayout values (should all be 0 for linear)
		yLayoutField := frame.Fields[4]
		require.Equal(t, int8(0), yLayoutField.At(0))
		require.Equal(t, int8(0), yLayoutField.At(1))
		require.Equal(t, int8(0), yLayoutField.At(2))
		require.Equal(t, int8(0), yLayoutField.At(3))
	})

	t.Run("attaches labels to count field", func(t *testing.T) {
		points := []*Point{
			{
				Timestamp: time.Now().UnixMilli(),
				YMin:      []float64{0},
				Counts:    []int64{5},
			},
		}
		labels := map[string]string{"service": "api", "env": "prod"}

		frame := CreateHeatmapFrame(labels, points, "ns")

		countField := frame.Fields[3]
		require.NotNil(t, countField.Labels)
		require.Equal(t, "api", countField.Labels["service"])
		require.Equal(t, "prod", countField.Labels["env"])
	})

	t.Run("sets unit on yMin and yMax fields", func(t *testing.T) {
		points := []*Point{
			{
				Timestamp: time.Now().UnixMilli(),
				YMin:      []float64{0},
				Counts:    []int64{5},
			},
		}

		frame := CreateHeatmapFrame(map[string]string{}, points, "ns")

		// yMin field should have units
		yMinField := frame.Fields[1]
		require.NotNil(t, yMinField.Config)
		require.Equal(t, "ns", yMinField.Config.Unit)

		// yMax field should have units
		yMaxField := frame.Fields[2]
		require.NotNil(t, yMaxField.Config)
		require.Equal(t, "ns", yMaxField.Config.Unit)

		// count field should NOT have units (or have empty unit)
		countField := frame.Fields[3]
		if countField.Config != nil {
			require.Empty(t, countField.Config.Unit)
		}
	})

	t.Run("handles empty points", func(t *testing.T) {
		frame := CreateHeatmapFrame(map[string]string{}, []*Point{}, "ns")

		require.NotNil(t, frame)
		require.Len(t, frame.Fields, 5)
		require.Equal(t, 0, frame.Fields[0].Len())
		require.Equal(t, 0, frame.Fields[1].Len())
		require.Equal(t, 0, frame.Fields[2].Len())
		require.Equal(t, 0, frame.Fields[3].Len())
		require.Equal(t, 0, frame.Fields[4].Len())
	})

	t.Run("handles varying bucket counts per time point", func(t *testing.T) {
		timestamp1 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		timestamp2 := time.Date(2024, 1, 1, 0, 1, 0, 0, time.UTC)

		points := []*Point{
			{
				Timestamp: timestamp1.UnixMilli(),
				YMin:      []float64{0, 100, 200},
				Counts:    []int64{5, 10, 3},
			},
			{
				Timestamp: timestamp2.UnixMilli(),
				YMin:      []float64{0, 100},
				Counts:    []int64{7, 12},
			},
		}

		frame := CreateHeatmapFrame(map[string]string{}, points, "ns")

		// Should create 5 cells total (3 from first point + 2 from second)
		require.Equal(t, 5, frame.Fields[0].Len())
	})
}
