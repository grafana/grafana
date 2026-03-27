package heatmap

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Slot represents a single heatmap slot with timestamp, bucket minimums, and counts
type Slot struct {
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

// CreateHeatmapFrame converts heatmap slots to a DataFrame in HeatmapCells sparse format.
// Only non-zero cells are emitted; absent cells are implicitly zero.
// Fields (in order): xMax (Time), yMin (Number), yMax (Number), count (Number).
// Having both yMin and yMax signals a sparse heatmap to the frontend.
//
// The contract for this can be found here: https://github.com/grafana/dataplane/blob/main/docs/contract/heatmap.md
func CreateHeatmapFrame(labels map[string]string, slots []*Slot, units string, stepSeconds float64) *data.Frame {
	frameName := generateFrameName(labels)
	frame := data.NewFrame(frameName)
	frame.Meta = &data.FrameMeta{
		Type: "heatmap-cells",
	}

	stepMs := int64(stepSeconds * 1000)
	frame.Fields = data.Fields{
		data.NewField("xMax", nil, []time.Time{}).SetConfig(&data.FieldConfig{}),
		data.NewField("yMin", nil, []float64{}).SetConfig(&data.FieldConfig{
			Unit: units,
		}),
		data.NewField("yMax", nil, []float64{}).SetConfig(&data.FieldConfig{
			Unit: units,
		}),
		data.NewField("count", labels, []int64{}),
	}

	for i, slot := range slots {
		xMax := time.UnixMilli(slot.Timestamp)
		nBuckets := len(slot.Counts)
		for j := 0; j < nBuckets; j++ {
			if slot.Counts[j] == 0 {
				continue
			}

			var yMax float64
			if j < len(slot.YMin)-1 {
				yMax = slot.YMin[j+1]
			} else if j > 0 {
				yMax = slot.YMin[j] + (slot.YMin[j] - slot.YMin[j-1])
			} else {
				yMax = slot.YMin[j] * 2
			}

			frame.AppendRow(
				xMax,
				slot.YMin[j],
				yMax,
				slot.Counts[j],
			)
		}

		// Unlike the contract the panel doesn't respect xMin, instead it infers the correct bucket
		// width from the size of the first gap in xMax.
		// So if the next slot is more than one step away, insert a zero-count calibration
		// row at timestamp+stepMs so the panel sees the correct bucket width.
		if i == 0 && len(slots) > 1 && slots[1].Timestamp != slot.Timestamp+stepMs {
			calTs := time.UnixMilli(slot.Timestamp + stepMs)
			var calYMin, calYMax float64
			if len(slot.YMin) > 1 {
				calYMin, calYMax = slot.YMin[0], slot.YMin[1]
			} else if len(slot.YMin) == 1 {
				calYMin = slot.YMin[0]
				calYMax = slot.YMin[0] * 2
			}
			frame.AppendRow(calTs, calYMin, calYMax, int64(0))
		}
	}

	return frame
}
