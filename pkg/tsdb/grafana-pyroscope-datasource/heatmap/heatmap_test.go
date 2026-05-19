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
		slots := []*Slot{
			{
				Timestamp: now.UnixMilli(),
				YMin:      []float64{0, 100, 200},
				Counts:    []int64{5, 10, 3},
			},
		}
		labels := map[string]string{"service": "api"}

		frame := CreateHeatmapFrame(labels, slots, "ns", 15.0)

		require.NotNil(t, frame)
		require.Equal(t, "heatmap{service=api}", frame.Name)
		require.NotNil(t, frame.Meta)
		require.Equal(t, data.FrameType("heatmap-cells"), frame.Meta.Type)
	})

	t.Run("creates correct fields structure", func(t *testing.T) {
		stepDuration := 15.0 // 15 seconds
		timestamp := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		slots := []*Slot{
			{
				Timestamp: timestamp.UnixMilli(),
				YMin:      []float64{0, 100, 200},
				Counts:    []int64{5, 10, 3},
			},
		}

		frame := CreateHeatmapFrame(map[string]string{}, slots, "ns", stepDuration)

		require.Len(t, frame.Fields, 4)
		require.Equal(t, "xMax", frame.Fields[0].Name)
		require.Equal(t, "yMin", frame.Fields[1].Name)
		require.Equal(t, "yMax", frame.Fields[2].Name)
		require.Equal(t, "count", frame.Fields[3].Name)
	})

	t.Run("correctly expands multiple time points into cells", func(t *testing.T) {
		timestamp1 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		timestamp2 := time.Date(2024, 1, 1, 0, 0, 15, 0, time.UTC) // 15 seconds later (1 step)
		stepDuration := 15.0                                       // 15 seconds

		slots := []*Slot{
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

		frame := CreateHeatmapFrame(map[string]string{}, slots, "ns", stepDuration)

		// Should create 4 cells total (2 time points × 2 buckets, no gaps to fill)
		require.Equal(t, 4, frame.Fields[0].Len())
		require.Equal(t, 4, frame.Fields[1].Len())
		require.Equal(t, 4, frame.Fields[2].Len())
		require.Equal(t, 4, frame.Fields[3].Len())

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
	})

	t.Run("attaches labels to count field", func(t *testing.T) {
		now := time.Now()
		slots := []*Slot{
			{
				Timestamp: now.UnixMilli(),
				YMin:      []float64{0},
				Counts:    []int64{5},
			},
		}
		labels := map[string]string{"service": "api", "env": "prod"}

		frame := CreateHeatmapFrame(labels, slots, "ns", 15.0)

		countField := frame.Fields[3]
		require.NotNil(t, countField.Labels)
		require.Equal(t, "api", countField.Labels["service"])
		require.Equal(t, "prod", countField.Labels["env"])
	})

	t.Run("creates unique frame name based on labels", func(t *testing.T) {
		now := time.Now()
		slots := []*Slot{
			{
				Timestamp: now.UnixMilli(),
				YMin:      []float64{0},
				Counts:    []int64{5},
			},
		}
		labels := map[string]string{"service": "api", "env": "prod"}

		frame := CreateHeatmapFrame(labels, slots, "ns", 15.0)

		// Frame name should include labels in sorted order
		require.Equal(t, "heatmap{env=prod,service=api}", frame.Name)
	})

	t.Run("sets unit on yMin and yMax fields", func(t *testing.T) {
		now := time.Now()
		slots := []*Slot{
			{
				Timestamp: now.UnixMilli(),
				YMin:      []float64{0},
				Counts:    []int64{5},
			},
		}

		frame := CreateHeatmapFrame(map[string]string{}, slots, "ns", 15.0)

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
		frame := CreateHeatmapFrame(map[string]string{}, []*Slot{}, "ns", 15.0)

		require.NotNil(t, frame)
		require.Len(t, frame.Fields, 4)
		require.Equal(t, 0, frame.Fields[0].Len())
		require.Equal(t, 0, frame.Fields[1].Len())
		require.Equal(t, 0, frame.Fields[2].Len())
		require.Equal(t, 0, frame.Fields[3].Len())
	})

	t.Run("handles varying bucket counts per time point", func(t *testing.T) {
		timestamp1 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		timestamp2 := time.Date(2024, 1, 1, 0, 0, 15, 0, time.UTC) // 15 seconds later (1 step)

		slots := []*Slot{
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

		frame := CreateHeatmapFrame(map[string]string{}, slots, "ns", 15.0)

		// Each point is rendered with its own bucket count (no padding).
		// 3 buckets (point 1) + 2 buckets (point 2) = 5 cells
		require.Equal(t, 5, frame.Fields[0].Len())
	})

	t.Run("skips zero-count cells (sparse)", func(t *testing.T) {
		timestamp1 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		timestamp2 := time.Date(2024, 1, 1, 0, 0, 45, 0, time.UTC) // 3 steps later

		slots := []*Slot{
			{
				Timestamp: timestamp1.UnixMilli(),
				YMin:      []float64{0, 100},
				Counts:    []int64{5, 0},
			},
			{
				Timestamp: timestamp2.UnixMilli(),
				YMin:      []float64{0, 100},
				Counts:    []int64{0, 12},
			},
		}

		frame := CreateHeatmapFrame(map[string]string{}, slots, "ns", 15.0)

		// 1 non-zero cell from point1 + 1 calibration row (gap > stepMs) + 1 non-zero cell from point2
		require.Equal(t, 3, frame.Fields[0].Len())

		xMaxField := frame.Fields[0]
		calibrationTs := timestamp1.Add(15 * time.Second)
		require.Equal(t, timestamp1.UnixMilli(), xMaxField.At(0).(time.Time).UnixMilli())
		require.Equal(t, calibrationTs.UnixMilli(), xMaxField.At(1).(time.Time).UnixMilli())
		require.Equal(t, timestamp2.UnixMilli(), xMaxField.At(2).(time.Time).UnixMilli())

		countField := frame.Fields[3]
		require.Equal(t, int64(5), countField.At(0))
		require.Equal(t, int64(0), countField.At(1)) // calibration row
		require.Equal(t, int64(12), countField.At(2))
	})
}

// TestCreateHeatmapFrameFromRealAPIData tests CreateHeatmapFrame against a real
// Pyroscope SelectHeatmap API response (pyroscope-api.json at the repo root).
//
// The response contains 4 slots with two gaps of 3 steps each:
//
//	slot 1: ts=1774522307000  counts[0]=5
//	slot 2: ts=1774522352000  counts[19]=1
//	slot 3: ts=1774522367000  counts[0]=1
//	slot 4: ts=1774522412000  counts[0]=17, counts[14]=1
//
// Sparse output: only 5 non-zero cells emitted (gaps and zero buckets are omitted).
func TestCreateHeatmapFrameFromRealAPIData(t *testing.T) {
	yMin := []float64{
		10000000, 176500000, 343000000, 509500000, 676000000,
		842500000, 1009000000, 1175500000, 1342000000, 1508500000,
		1675000000, 1841500000, 2008000000, 2174500000, 2341000000,
		2507500000, 2674000000, 2840500000, 3007000000, 3173500000,
	}
	slot1Counts := make([]int64, 20)
	slot1Counts[0] = 5
	slot2Counts := make([]int64, 20)
	slot2Counts[19] = 1
	slot3Counts := make([]int64, 20)
	slot3Counts[0] = 1
	slot4Counts := make([]int64, 20)
	slot4Counts[0] = 17
	slot4Counts[14] = 1

	slots := []*Slot{
		{Timestamp: 1774522307000, YMin: yMin, Counts: slot1Counts},
		{Timestamp: 1774522352000, YMin: yMin, Counts: slot2Counts},
		{Timestamp: 1774522367000, YMin: yMin, Counts: slot3Counts},
		{Timestamp: 1774522412000, YMin: yMin, Counts: slot4Counts},
	}

	frame := CreateHeatmapFrame(map[string]string{}, slots, "ns", 15.0)

	// 5 non-zero cells + 1 calibration row inserted after slot1 (gap to slot2 is 3 steps).
	require.Equal(t, 6, frame.Fields[0].Len())
	xMax := frame.Fields[0]
	yMinField := frame.Fields[1]
	yMaxField := frame.Fields[2]
	counts := frame.Fields[3]

	// cell 0: slot1, bucket 0
	require.Equal(t, int64(1774522307000), xMax.At(0).(time.Time).UnixMilli())
	require.Equal(t, float64(10000000), yMinField.At(0))
	require.Equal(t, float64(176500000), yMaxField.At(0))
	require.Equal(t, int64(5), counts.At(0))

	// cell 1: calibration row at slot1+stepMs — ensures panel sees correct bucket width
	require.Equal(t, int64(1774522322000), xMax.At(1).(time.Time).UnixMilli()) // 1774522307000 + 15000
	require.Equal(t, float64(10000000), yMinField.At(1))
	require.Equal(t, float64(176500000), yMaxField.At(1))
	require.Equal(t, int64(0), counts.At(1))

	// cell 2: slot2, bucket 19 (last bucket — yMax extrapolated)
	require.Equal(t, int64(1774522352000), xMax.At(2).(time.Time).UnixMilli())
	require.Equal(t, float64(3173500000), yMinField.At(2))
	require.Equal(t, float64(3340000000), yMaxField.At(2)) // yMin[19] + (yMin[19]-yMin[18])
	require.Equal(t, int64(1), counts.At(2))

	// cell 3: slot3, bucket 0
	require.Equal(t, int64(1774522367000), xMax.At(3).(time.Time).UnixMilli())
	require.Equal(t, int64(1), counts.At(3))

	// cell 4: slot4, bucket 0
	require.Equal(t, int64(1774522412000), xMax.At(4).(time.Time).UnixMilli())
	require.Equal(t, int64(17), counts.At(4))

	// cell 5: slot4, bucket 14
	require.Equal(t, int64(1774522412000), xMax.At(5).(time.Time).UnixMilli())
	require.Equal(t, float64(2341000000), yMinField.At(5))
	require.Equal(t, float64(2507500000), yMaxField.At(5))
	require.Equal(t, int64(1), counts.At(5))
}
