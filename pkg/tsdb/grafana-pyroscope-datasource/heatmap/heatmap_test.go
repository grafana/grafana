package heatmap

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestGenerateFrameName(t *testing.T) {
	t.Run("empty labels returns default name", func(t *testing.T) {
		name := generateFrameName(map[string]string{})
		require.Equal(t, "heatmap", name)
	})

	t.Run("single label", func(t *testing.T) {
		name := generateFrameName(map[string]string{"service": "api"})
		require.Equal(t, "heatmap{service=api}", name)
	})

	t.Run("multiple labels sorted", func(t *testing.T) {
		name := generateFrameName(map[string]string{
			"service": "api",
			"env":     "prod",
			"region":  "us-west",
		})
		// Labels should be sorted alphabetically
		require.Equal(t, "heatmap{env=prod,region=us-west,service=api}", name)
	})
}

func TestCreateHeatmapFrame(t *testing.T) {
	t.Run("creates frame with correct metadata", func(t *testing.T) {
		now := time.Now()
		points := []*Point{
			{
				Timestamp: now.UnixMilli(),
				YMin:      []float64{0, 100, 200},
				Counts:    []int64{5, 10, 3},
			},
		}
		labels := map[string]string{"service": "api"}

		frame := CreateHeatmapFrame(labels, points, "ns", 15.0)

		require.NotNil(t, frame)
		require.Equal(t, "heatmap{service=api}", frame.Name)
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

		frame := CreateHeatmapFrame(map[string]string{}, points, "ns", 15.0)

		require.Len(t, frame.Fields, 5)
		require.Equal(t, "xMax", frame.Fields[0].Name)
		require.Equal(t, "yMin", frame.Fields[1].Name)
		require.Equal(t, "yMax", frame.Fields[2].Name)
		require.Equal(t, "count", frame.Fields[3].Name)
		require.Equal(t, "yLayout", frame.Fields[4].Name)
	})

	t.Run("correctly expands multiple time points into cells", func(t *testing.T) {
		timestamp1 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		timestamp2 := time.Date(2024, 1, 1, 0, 0, 15, 0, time.UTC) // 15 seconds later (1 step)
		stepDuration := 15.0 // 15 seconds

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

		frame := CreateHeatmapFrame(map[string]string{}, points, "ns", stepDuration)

		// Should create 4 cells total (2 time points × 2 buckets, no gaps to fill)
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
		now := time.Now()
		points := []*Point{
			{
				Timestamp: now.UnixMilli(),
				YMin:      []float64{0},
				Counts:    []int64{5},
			},
		}
		labels := map[string]string{"service": "api", "env": "prod"}

		frame := CreateHeatmapFrame(labels, points, "ns", 15.0)

		countField := frame.Fields[3]
		require.NotNil(t, countField.Labels)
		require.Equal(t, "api", countField.Labels["service"])
		require.Equal(t, "prod", countField.Labels["env"])
	})

	t.Run("creates unique frame name based on labels", func(t *testing.T) {
		now := time.Now()
		points := []*Point{
			{
				Timestamp: now.UnixMilli(),
				YMin:      []float64{0},
				Counts:    []int64{5},
			},
		}
		labels := map[string]string{"service": "api", "env": "prod"}

		frame := CreateHeatmapFrame(labels, points, "ns", 15.0)

		// Frame name should include labels in sorted order
		require.Equal(t, "heatmap{env=prod,service=api}", frame.Name)
	})

	t.Run("sets unit on yMin and yMax fields", func(t *testing.T) {
		now := time.Now()
		points := []*Point{
			{
				Timestamp: now.UnixMilli(),
				YMin:      []float64{0},
				Counts:    []int64{5},
			},
		}

		frame := CreateHeatmapFrame(map[string]string{}, points, "ns", 15.0)

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
		frame := CreateHeatmapFrame(map[string]string{}, []*Point{}, "ns", 15.0)

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
		timestamp2 := time.Date(2024, 1, 1, 0, 0, 15, 0, time.UTC) // 15 seconds later (1 step)

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

		frame := CreateHeatmapFrame(map[string]string{}, points, "ns", 15.0)

		// Should use the most complete bucket structure (3 buckets from first point)
		// 2 time points × 3 buckets = 6 cells
		require.Equal(t, 6, frame.Fields[0].Len())
	})

	t.Run("fills missing time slices with zero counts", func(t *testing.T) {
		timestamp1 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		timestamp2 := time.Date(2024, 1, 1, 0, 0, 45, 0, time.UTC) // 45 seconds later (3 steps of 15s)
		stepDuration := 15.0 // 15 seconds

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

		frame := CreateHeatmapFrame(map[string]string{}, points, "ns", stepDuration)

		// Should fill gaps: original 2 points + 2 gap points = 4 points
		// Each point has 2 buckets, so 4 * 2 = 8 cells total
		require.Equal(t, 8, frame.Fields[0].Len())

		// Check timestamps are continuous
		xMaxField := frame.Fields[0]
		expectedTimestamps := []int64{
			timestamp1.UnixMilli(),                     // Original point
			timestamp1.Add(15 * time.Second).UnixMilli(), // Gap fill
			timestamp1.Add(30 * time.Second).UnixMilli(), // Gap fill
			timestamp2.UnixMilli(),                     // Original point
		}

		for i, expected := range expectedTimestamps {
			// Each timestamp should appear twice (once per bucket)
			require.Equal(t, expected, xMaxField.At(i*2).(time.Time).UnixMilli())
			require.Equal(t, expected, xMaxField.At(i*2+1).(time.Time).UnixMilli())
		}

		// Check that gap-filled cells have zero counts
		countField := frame.Fields[3]
		require.Equal(t, int64(5), countField.At(0))  // Original
		require.Equal(t, int64(10), countField.At(1)) // Original
		require.Equal(t, int64(0), countField.At(2))  // Gap fill
		require.Equal(t, int64(0), countField.At(3))  // Gap fill
		require.Equal(t, int64(0), countField.At(4))  // Gap fill
		require.Equal(t, int64(0), countField.At(5))  // Gap fill
		require.Equal(t, int64(7), countField.At(6))  // Original
		require.Equal(t, int64(12), countField.At(7)) // Original
	})
}

func TestFillMissingTimeSlices(t *testing.T) {
	t.Run("no gaps returns original points", func(t *testing.T) {
		timestamp1 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		timestamp2 := time.Date(2024, 1, 1, 0, 0, 15, 0, time.UTC)
		stepDuration := 15.0

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

		filled := fillMissingTimeSlices(points, stepDuration)

		require.Len(t, filled, 2)
		require.Equal(t, timestamp1.UnixMilli(), filled[0].Timestamp)
		require.Equal(t, timestamp2.UnixMilli(), filled[1].Timestamp)
	})

	t.Run("fills single gap", func(t *testing.T) {
		timestamp1 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		timestamp2 := time.Date(2024, 1, 1, 0, 0, 30, 0, time.UTC) // 2 steps later
		stepDuration := 15.0

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

		filled := fillMissingTimeSlices(points, stepDuration)

		require.Len(t, filled, 3)
		require.Equal(t, timestamp1.UnixMilli(), filled[0].Timestamp)
		require.Equal(t, timestamp1.Add(15*time.Second).UnixMilli(), filled[1].Timestamp)
		require.Equal(t, timestamp2.UnixMilli(), filled[2].Timestamp)

		// Check gap point has zero counts
		require.Equal(t, []int64{0, 0}, filled[1].Counts)
		require.Equal(t, []float64{0, 100}, filled[1].YMin)
	})

	t.Run("fills multiple gaps", func(t *testing.T) {
		timestamp1 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		timestamp2 := time.Date(2024, 1, 1, 0, 1, 0, 0, time.UTC) // 4 steps later
		stepDuration := 15.0

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

		filled := fillMissingTimeSlices(points, stepDuration)

		require.Len(t, filled, 5)
		require.Equal(t, timestamp1.UnixMilli(), filled[0].Timestamp)
		require.Equal(t, timestamp1.Add(15*time.Second).UnixMilli(), filled[1].Timestamp)
		require.Equal(t, timestamp1.Add(30*time.Second).UnixMilli(), filled[2].Timestamp)
		require.Equal(t, timestamp1.Add(45*time.Second).UnixMilli(), filled[3].Timestamp)
		require.Equal(t, timestamp2.UnixMilli(), filled[4].Timestamp)

		// Check all gap points have zero counts
		for i := 1; i <= 3; i++ {
			require.Equal(t, []int64{0, 0}, filled[i].Counts)
		}
	})

	t.Run("handles empty points", func(t *testing.T) {
		filled := fillMissingTimeSlices([]*Point{}, 15.0)
		require.Len(t, filled, 0)
	})

	t.Run("handles single point", func(t *testing.T) {
		timestamp := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		points := []*Point{
			{
				Timestamp: timestamp.UnixMilli(),
				YMin:      []float64{0, 100},
				Counts:    []int64{5, 10},
			},
		}

		filled := fillMissingTimeSlices(points, 15.0)

		require.Len(t, filled, 1)
		require.Equal(t, timestamp.UnixMilli(), filled[0].Timestamp)
	})
}
