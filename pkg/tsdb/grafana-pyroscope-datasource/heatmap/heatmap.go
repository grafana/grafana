package heatmap

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Point represents a single heatmap point with timestamp, bucket minimums, and counts
type Point struct {
	Timestamp int64
	YMin      []float64
	Counts    []int64
}

// generateFrameName creates a unique frame name from labels
// If labels are empty, returns "heatmap"
// Otherwise returns "heatmap{label1=value1,label2=value2,...}"
func generateFrameName(labels map[string]string) string {
	if len(labels) == 0 {
		return "heatmap"
	}

	// Sort label keys for consistent ordering
	keys := make([]string, 0, len(labels))
	for k := range labels {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	// Build label string
	pairs := make([]string, 0, len(labels))
	for _, k := range keys {
		pairs = append(pairs, fmt.Sprintf("%s=%s", k, labels[k]))
	}

	return fmt.Sprintf("heatmap{%s}", strings.Join(pairs, ","))
}

// fillMissingTimeSlices ensures continuous time coverage by filling gaps between data points.
// This prevents visual gaps in the heatmap. Points are assumed to be in increasing timestamp order.
func fillMissingTimeSlices(points []*Point, stepSeconds float64) []*Point {
	if len(points) == 0 {
		return points
	}

	// Determine the common bucket structure (YMin values)
	// Find the most complete bucket structure across all points
	templateYMin := points[0].YMin
	for _, point := range points {
		if len(point.YMin) > len(templateYMin) {
			templateYMin = point.YMin
		}
	}

	stepMs := int64(stepSeconds * 1000)
	filled := make([]*Point, 0, len(points)*2) // Estimate: assume some gaps
	zeroCounts := make([]int64, len(templateYMin))

	// Process first point, normalizing bucket structure if needed
	firstPoint := points[0]
	if len(firstPoint.YMin) < len(templateYMin) {
		paddedCounts := make([]int64, len(templateYMin))
		copy(paddedCounts, firstPoint.Counts)
		filled = append(filled, &Point{
			Timestamp: firstPoint.Timestamp,
			YMin:      templateYMin,
			Counts:    paddedCounts,
		})
	} else {
		filled = append(filled, firstPoint)
	}

	// Iterate through remaining points and fill gaps as we find them
	for i := 1; i < len(points); i++ {
		prevTimestamp := filled[len(filled)-1].Timestamp
		currTimestamp := points[i].Timestamp

		// Fill any gaps between previous and current point
		expectedTimestamp := prevTimestamp + stepMs
		for expectedTimestamp < currTimestamp {
			filled = append(filled, &Point{
				Timestamp: expectedTimestamp,
				YMin:      templateYMin,
				Counts:    append([]int64(nil), zeroCounts...), // Copy to avoid sharing
			})
			expectedTimestamp += stepMs
		}

		// Add current point, normalizing bucket structure if needed
		currPoint := points[i]
		if len(currPoint.YMin) < len(templateYMin) {
			paddedCounts := make([]int64, len(templateYMin))
			copy(paddedCounts, currPoint.Counts)
			filled = append(filled, &Point{
				Timestamp: currTimestamp,
				YMin:      templateYMin,
				Counts:    paddedCounts,
			})
		} else {
			filled = append(filled, currPoint)
		}
	}

	return filled
}

// CreateHeatmapFrame converts heatmap points to a DataFrame in HeatmapCells format
// This creates a sparse representation where each cell is explicitly defined by:
// - xMax: time value (timestamp)
// - yMin: bucket minimum value
// - yMax: bucket maximum value
// - count: number of matches in that bucket
// - yLayout: bucket layout (0 for linear buckets)
//
// Parameters:
// - labels: metric labels for the heatmap series
// - points: data points in increasing timestamp order (may have gaps in time coverage)
// - units: unit string for Y-axis values
// - stepSeconds: duration of each time bucket in seconds
//
// The function ensures continuous time coverage by filling gaps between points with zero counts.
func CreateHeatmapFrame(labels map[string]string, points []*Point, units string, stepSeconds float64) *data.Frame {
	frameName := generateFrameName(labels)
	frame := data.NewFrame(frameName)
	frame.Meta = &data.FrameMeta{
		Type: "heatmap-cells",
	}

	// Calculate total number of cells across all points
	totalCells := 0
	for _, point := range points {
		totalCells += len(point.Counts)
	}

	// Create data fields in the order expected by heatmap-cells format
	// Set interval (in milliseconds) on xMax field so frontend can calculate xMin for bucket boundaries
	intervalMs := int64(stepSeconds * 1000)
	frame.Fields = data.Fields{
		data.NewField("xMax", nil, make([]time.Time, 0, totalCells)).SetConfig(&data.FieldConfig{
			Interval: float64(intervalMs),
		}),
		data.NewField("yMin", nil, make([]float64, 0, totalCells)).SetConfig(&data.FieldConfig{
			Unit: units,
		}),
		data.NewField("yMax", nil, make([]float64, 0, totalCells)).SetConfig(&data.FieldConfig{
			Unit: units,
		}),
		data.NewField("count", labels, make([]int64, 0, totalCells)),
		data.NewField("yLayout", nil, make([]int8, 0, totalCells)),
	}

	if totalCells == 0 {
		return frame
	}

	// Fill missing time slices and normalize bucket structures
	points = fillMissingTimeSlices(points, stepSeconds)

	// Populate cells: for each time point, create a cell for each bucket
	for _, point := range points {
		timestamp := time.UnixMilli(point.Timestamp)
		for i := 0; i < len(point.Counts); i++ {
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

			frame.AppendRow(
				timestamp,
				point.YMin[i],
				yMax,
				point.Counts[i],
				int8(0), // 0 indicates linear bucket layout
			)
		}
	}

	return frame
}
