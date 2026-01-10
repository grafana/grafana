package heatmap

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Point represents a single heatmap point with timestamp, bucket minimums, and counts
type Point struct {
	Timestamp int64
	YMin      []float64
	Counts    []int64
}

// CreateHeatmapFrame converts heatmap points to a DataFrame in HeatmapCells format
// This creates a sparse representation where each cell is explicitly defined by:
// - xMax: time value (timestamp)
// - yMin: bucket minimum value
// - yMax: bucket maximum value
// - count: number of matches in that bucket
// - yLayout: bucket layout (0 for linear buckets)
func CreateHeatmapFrame(labels map[string]string, points []*Point, units string) *data.Frame {
	frame := data.NewFrame("heatmap")
	frame.Meta = &data.FrameMeta{
		Type: "heatmap-cells",
	}

	// Calculate total number of cells across all points
	totalCells := 0
	for _, point := range points {
		totalCells += len(point.Counts)
	}

	// Pre-allocate slices for better performance
	xMaxValues := make([]time.Time, 0, totalCells)
	yMinValues := make([]float64, 0, totalCells)
	yMaxValues := make([]float64, 0, totalCells)
	countValues := make([]int64, 0, totalCells)
	yLayoutValues := make([]int8, 0, totalCells)

	// Populate cells: for each time point, create a cell for each bucket
	for _, point := range points {
		timestamp := time.UnixMilli(point.Timestamp)
		for i := 0; i < len(point.Counts); i++ {
			xMaxValues = append(xMaxValues, timestamp)
			yMinValues = append(yMinValues, point.YMin[i])

			// Calculate yMax: for bucket i, yMax is yMin of bucket i+1
			// For the last bucket, use a large value or calculate based on bucket width
			var yMax float64
			if i < len(point.YMin)-1 {
				yMax = point.YMin[i+1]
			} else {
				// For the last bucket, calculate based on the previous bucket width
				if i > 0 {
					bucketWidth := point.YMin[i] - point.YMin[i-1]
					yMax = point.YMin[i] + bucketWidth
				} else {
					// Single bucket case: use a reasonable default
					yMax = point.YMin[i] * 2
				}
			}
			yMaxValues = append(yMaxValues, yMax)
			countValues = append(countValues, point.Counts[i])
			yLayoutValues = append(yLayoutValues, 0) // 0 indicates linear bucket layout
		}
	}

	// Create data fields in the order expected by heatmap-cells format
	frame.Fields = data.Fields{
		data.NewField("xMax", nil, xMaxValues),
		data.NewField("yMin", nil, yMinValues).SetConfig(&data.FieldConfig{
			Unit: units,
		}),
		data.NewField("yMax", nil, yMaxValues).SetConfig(&data.FieldConfig{
			Unit: units,
		}),
		data.NewField("count", labels, countValues),
		data.NewField("yLayout", nil, yLayoutValues),
	}

	return frame
}
