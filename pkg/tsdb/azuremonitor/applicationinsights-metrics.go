package azuremonitor

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// ToFrame converts a MetricsResult (a Application Insights metrics query) to a dataframe.
// Due to the dynamic nature of the MetricsResult object, the name of the metric, aggregation, and
// and requested dimensions are used to determine the expected shape of the object.
// This builds all series into a single data.Frame with one time index (a wide formatted time series frame).
func (mr *MetricsResult) ToFrame(metric, agg string, dimensions []string) (*data.Frame, error) {
	dimLen := len(dimensions)

	// The Response has both Start and End times, so we name the column "StartTime".
	frame := data.NewFrame("", data.NewField("StartTime", nil, []time.Time{}))

	fieldIdxMap := map[string]int{} // a map of a string representation of the labels to the Field index in the frame.

	rowCounter := 0 // row in the resulting frame

	if mr == nil || mr.Value == nil { // never seen this response, but to ensure there is no panic
		return nil, fmt.Errorf("unexpected nil response or response value in metrics result")
	}

	for _, seg := range *mr.Value.Segments { // each top level segment in the response shares timestamps.
		frame.Extend(1)
		frame.Set(0, rowCounter, seg.Start) // field 0 is the time field
		labels := data.Labels{}

		// handleLeafSegment is for the leaf MetricsSegmentInfo nodes in the response.
		// A leaf node contains an aggregated value, and when there are multiple dimensions, a label key/value pair.
		handleLeafSegment := func(s MetricsSegmentInfo) error {

			// since this is a dynamic response, everything we are interested in here from JSON
			// is Marshalled (mapped) into the AdditionalProperties property.
			met, ok := s.AdditionalProperties[metric]
			if !ok {
				return fmt.Errorf("expected additional properties for metric %v not found in inner segment", metric)
			}
			metMap, ok := met.(map[string]interface{})
			if !ok {
				return fmt.Errorf("unexpected type for additional properties not found in inner segment, want map[string]interface{}, but got %T", met)

			}
			metVal, ok := metMap[agg]
			if !ok {
				return fmt.Errorf("expected value for aggregation %v not found in inner segment", agg)
			}

			if dimLen != 0 { // when there are dimensions, the final dimension is in this inner segment.
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
				// When we find a new combintation of labels for the metric, a new Field is appended.
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
			if err := handleLeafSegment(seg); err != nil {
				return nil, err
			}
			rowCounter++
			continue
		}

		// Multiple dimension case
		var traverse func(segments *[]MetricsSegmentInfo, depth int) error

		// traverse walks segments collecting dimensions as labels until leaf segments are
		// reached, and then handleInnerSegment is called. The final k/v label pair is
		// in the leaf segment.
		// A non-recursive implementation would probably be better.
		traverse = func(segments *[]MetricsSegmentInfo, depth int) error {
			if segments == nil {
				return nil
			}
			for _, seg := range *segments {
				if seg.Segments == nil {
					if err := handleLeafSegment(seg); err != nil {
						return err
					}
					continue
				}
				dimension := dimensions[depth]
				rawLabelValue, ok := seg.AdditionalProperties[dimension]
				if !ok {
					return fmt.Errorf("expected label key %v not found at expected depth %v in response", dimension, depth)
				}
				labelValue, ok := rawLabelValue.(string)
				if !ok {
					return fmt.Errorf("unexpected non string value for the label value for key %v, got type %T with a value of %v", dimension, rawLabelValue, rawLabelValue)
				}
				labels[dimension] = labelValue
				if err := traverse(seg.Segments, depth+1); err != nil {
					return err
				}
			}
			return nil
		}

		if err := traverse(seg.Segments, 0); err != nil {
			return nil, err
		}
		rowCounter++
	}
	return frame, nil
}

// MetricsResult a metric result.
// This is copied from azure-sdk-for-go/services/preview/appinsights/v1/insights.
type MetricsResult struct {
	Value *MetricsResultInfo `json:"value,omitempty"`
}

// MetricsResultInfo a metric result data.
// This is copied from azure-sdk-for-go/services/preview/appinsights/v1/insights (except time Type is changed).
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

// MetricsSegmentInfo is a metric segment.
// This is copied from azure-sdk-for-go/services/preview/appinsights/v1/insights (except time Type is changed).
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
// This is copied from azure-sdk-for-go/services/preview/appinsights/v1/insights (except time Type is changed).
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
// This is copied from azure-sdk-for-go/services/preview/appinsights/v1/insights (except time Type is changed).
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
