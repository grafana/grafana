package exemplar

import (
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type Exemplar struct {
	ProfileId string
	SpanId    string
	Value     float64
	Timestamp int64
	Labels    map[string]string
}

type ExemplarType string

const (
	ExemplarTypeProfile ExemplarType = "profile"
	ExemplarTypeSpan    ExemplarType = "span"
)

func CreateExemplarFrame(labels map[string]string, exemplars []*Exemplar, exemplarType ExemplarType, units string) *data.Frame {
	frame := data.NewFrame("exemplar")
	frame.Meta = &data.FrameMeta{
		DataTopic: data.DataTopicAnnotations,
	}

	// Determine display name and which ID to use based on exemplar type
	displayName := "Profile ID"
	if exemplarType == ExemplarTypeSpan {
		displayName = "Span ID"
	}

	// Collect all unique label names across all exemplars
	uniqLabelNames := make(map[string]struct{})
	for _, e := range exemplars {
		for name := range e.Labels {
			uniqLabelNames[name] = struct{}{}
		}
	}
	for name := range labels {
		uniqLabelNames[name] = struct{}{}
	}

	// Initialize fields
	const offset = 3
	fields := make([]*data.Field, 0, len(uniqLabelNames)+offset)
	fields = append(fields, data.NewField("Time", nil, make([]time.Time, 0, len(exemplars))))
	fields = append(fields, data.NewField("Value", labels, make([]float64, 0, len(exemplars)))) // Series labels attached to Value field
	fields = append(fields, data.NewField("Id", nil, make([]string, 0, len(exemplars))))

	// Configure the Value field with units and display name
	valueFieldConfig := &data.FieldConfig{
		DisplayName: "Value",
		Unit:        units,
	}
	fields[1].Config = valueFieldConfig

	// Configure the Id field with display name
	idFieldConfig := &data.FieldConfig{
		DisplayName: displayName,
	}
	fields[2].Config = idFieldConfig

	sortedLabelNames := make([]string, 0, len(uniqLabelNames))
	for name := range uniqLabelNames {
		sortedLabelNames = append(sortedLabelNames, name)
	}
	sort.Strings(sortedLabelNames)

	// Create fields for all label names
	for _, name := range sortedLabelNames {
		fields = append(fields, data.NewField(name, nil, make([]string, 0, len(exemplars))))
	}

	frame.Fields = fields

	row := make([]any, len(uniqLabelNames)+offset)
	for _, e := range exemplars {
		row[0] = time.UnixMilli(e.Timestamp)
		row[1] = e.Value

		// Use the appropriate ID based on exemplar type
		if exemplarType == ExemplarTypeSpan {
			row[2] = e.SpanId
		} else if exemplarType == ExemplarTypeProfile {
			row[2] = e.ProfileId
		}

		// Append label values: prefer exemplar-specific values over series values
		for idx, name := range sortedLabelNames {
			// Check if this exemplar has this label
			if value, ok := e.Labels[name]; ok {
				row[idx+offset] = value
				continue
			}
			if value, ok := labels[name]; ok {
				row[idx+offset] = value
				continue
			}
			row[idx+offset] = ""
		}

		frame.AppendRow(row...)
	}
	return frame
}
