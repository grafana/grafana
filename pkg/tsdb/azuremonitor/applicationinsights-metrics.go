package azuremonitor

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// ToFrame converts a MetricsResult (a Application Insights metrics query) to a dataframe.
// Due to the dynamic nature of the MetricsResult object, the name of the metric, aggregation, and
// and requested dimensions are used to determine the expected shape of the object
func (mr *MetricsResult) ToFrame(metric, agg string, dimensions []string) (*data.Frame, error) {
	dimLen := len(dimensions)

	// The Response has both Start and End time, so we name the column "StartTime".
	frame := data.NewFrame("", data.NewField("StartTime", nil, []time.Time{})) // The Response has both Start and End time, so we name the column "StartTime".

	fieldIdxMap := map[string]int{}

	rowCounter := 0

	for _, seg := range *mr.Value.Segments {
		frame.Extend(1)
		frame.Set(0, rowCounter, seg.Start)
		labels := data.Labels{}

		handleInnerSegment := func(s MetricsSegmentInfo) error {
			met, ok := s.AdditionalProperties[metric]
			if !ok {
				return fmt.Errorf("expected additional properties not found on inner segment while handling azure query")
			}
			metMap, ok := met.(map[string]interface{})
			if !ok {
				return fmt.Errorf("unexpected type for additional properties not found on inner segment while handling azure query")
			}
			metVal, ok := metMap[agg]
			if !ok {
				return fmt.Errorf("expected aggregation value for aggregation %v not found on inner segment while handling azure query", agg)
			}
			if dimLen != 0 {
				key := dimensions[dimLen-1]
				val, ok := s.AdditionalProperties[key]
				if !ok {
					return fmt.Errorf("unexpected dimension/segment key %v not found in response", key)
				}
				sVal, ok := val.(string)
				if !ok {
					return fmt.Errorf("unexpected dimension/segment value for key %v in response", key)
				}
				labels[key] = sVal
			}
			if _, ok := fieldIdxMap[labels.String()]; !ok {
				frame.Fields = append(frame.Fields, data.NewField(metric, labels.Copy(), make([]*float64, rowCounter+1)))
				fieldIdxMap[labels.String()] = len(frame.Fields) - 1
			}
			var v *float64
			if val, ok := metVal.(float64); ok {
				v = &val
			}
			frame.Set(fieldIdxMap[labels.String()], rowCounter, v)

			return nil
		}

		// Simple case with no Segments/Dimensions
		if dimLen == 0 {
			err := handleInnerSegment(seg)
			rowCounter++
			if err != nil {
				return nil, err
			}
			continue
		}
		var traverse func(segments *[]MetricsSegmentInfo, depth int)
		traverse = func(segments *[]MetricsSegmentInfo, depth int) {
			if segments == nil {
				return
			}
			for _, seg := range *segments {
				if seg.Segments == nil {
					handleInnerSegment(seg)
					continue
				}
				segStr := dimensions[depth]
				labels[segStr] = seg.AdditionalProperties[segStr].(string)
				traverse(seg.Segments, depth+1)
			}
		}
		traverse(seg.Segments, 0)
		rowCounter++
	}
	return frame, nil
}

// MetricsResult a metric result.
type MetricsResult struct {
	Value *MetricsResultInfo `json:"value,omitempty"`
}

// MetricsResultInfo a metric result data.
type MetricsResultInfo struct {
	// AdditionalProperties - Unmatched properties from the message are deserialized this collection
	AdditionalProperties map[string]interface{} `json:""`
	// Start - Start time of the metric.
	Start time.Time `json:"start,omitempty"`
	// End - Start time of the metric.
	End time.Time `json:"end,omitempty"`
	// Interval - The interval used to segment the metric data.
	Interval *string `json:"interval,omitempty"`
	// Segments - Segmented metric data (if segmented).
	Segments *[]MetricsSegmentInfo `json:"segments,omitempty"`
}

// MetricsSegmentInfo a metric segment
type MetricsSegmentInfo struct {
	// AdditionalProperties - Unmatched properties from the message are deserialized this collection
	AdditionalProperties map[string]interface{} `json:""`
	// Start - Start time of the metric segment (only when an interval was specified).
	Start time.Time `json:"start,omitempty"`
	// End - Start time of the metric segment (only when an interval was specified).
	End time.Time `json:"end,omitempty"`
	// Segments - Segmented metric data (if further segmented).
	Segments *[]MetricsSegmentInfo `json:"segments,omitempty"`
}

// UnmarshalJSON is the custom unmarshaler for MetricsResultInfo struct.
func (mri *MetricsSegmentInfo) UnmarshalJSON(body []byte) error {
	var m map[string]*json.RawMessage
	err := json.Unmarshal(body, &m)
	if err != nil {
		return err
	}
	for k, v := range m {
		switch k {
		default:
			if v != nil {
				var additionalProperties interface{}
				err = json.Unmarshal(*v, &additionalProperties)
				if err != nil {
					return err
				}
				if mri.AdditionalProperties == nil {
					mri.AdditionalProperties = make(map[string]interface{})
				}
				mri.AdditionalProperties[k] = additionalProperties
			}
		case "start":
			if v != nil {
				var start time.Time
				err = json.Unmarshal(*v, &start)
				if err != nil {
					return err
				}
				mri.Start = start
			}
		case "end":
			if v != nil {
				var end time.Time
				err = json.Unmarshal(*v, &end)
				if err != nil {
					return err
				}
				mri.End = end
			}
		case "segments":
			if v != nil {
				var segments []MetricsSegmentInfo
				err = json.Unmarshal(*v, &segments)
				if err != nil {
					return err
				}
				mri.Segments = &segments
			}
		}
	}

	return nil
}

// UnmarshalJSON is the custom unmarshaler for MetricsResultInfo struct.
func (mri *MetricsResultInfo) UnmarshalJSON(body []byte) error {
	var m map[string]*json.RawMessage
	err := json.Unmarshal(body, &m)
	if err != nil {
		return err
	}
	for k, v := range m {
		switch k {
		default:
			if v != nil {
				var additionalProperties interface{}
				err = json.Unmarshal(*v, &additionalProperties)
				if err != nil {
					return err
				}
				if mri.AdditionalProperties == nil {
					mri.AdditionalProperties = make(map[string]interface{})
				}
				mri.AdditionalProperties[k] = additionalProperties
			}
		case "start":
			if v != nil {
				var start time.Time
				err = json.Unmarshal(*v, &start)
				if err != nil {
					return err
				}
				mri.Start = start
			}
		case "end":
			if v != nil {
				var end time.Time
				err = json.Unmarshal(*v, &end)
				if err != nil {
					return err
				}
				mri.End = end
			}
		case "interval":
			if v != nil {
				var interval string
				err = json.Unmarshal(*v, &interval)
				if err != nil {
					return err
				}
				mri.Interval = &interval
			}
		case "segments":
			if v != nil {
				var segments []MetricsSegmentInfo
				err = json.Unmarshal(*v, &segments)
				if err != nil {
					return err
				}
				mri.Segments = &segments
			}
		}
	}

	return nil
}
