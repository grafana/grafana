package exemplar

import (
	"sort"
	"strings"
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
			if strings.HasPrefix(name, "__") {
				continue
			}
			uniqLabelNames[name] = struct{}{}
		}
	}
	for name := range labels {
		uniqLabelNames[name] = struct{}{}
	}
	sortedLabelNames := make([]string, 0, len(uniqLabelNames))
	for name := range uniqLabelNames {
		sortedLabelNames = append(sortedLabelNames, name)
	}
	sort.Strings(sortedLabelNames)

	// Initialize fields
	const offset = 3
	fields := make([]*data.Field, 0, len(uniqLabelNames)+offset)
	fields = append(fields, data.NewField("Time", nil, make([]time.Time, 0, len(exemplars))))
	fields = append(fields, data.NewField("Value", labels, make([]float64, 0, len(exemplars)))) // Series labels attached to Value field
	fields = append(fields, data.NewField("Id", nil, make([]string, 0, len(exemplars))))

	// Configure the Value field with units and display name
	fields[1].Config = &data.FieldConfig{
		DisplayName: "Value",
		Unit:        units,
	}

	fields[2].Config = &data.FieldConfig{
		DisplayName: displayName,
	}

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
		switch exemplarType {
		case ExemplarTypeSpan:
			row[2] = e.SpanId
		case ExemplarTypeProfile:
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

// AddProfileDataLink attaches an internal data link to the "Id" field of a profile exemplar frame so that
// clicking an exemplar in Explore opens the individual profile as a flame graph in a split pane. The clicked
// exemplar's profile id is resolved at navigation time via the ${__value.raw} interpolation variable.
//
// The link only manifests in consumers that render exemplars with Grafana's standard timeseries panel (Explore,
// dashboards). The Profiles Drilldown app builds its own exemplar interactions and does not read these links.
func AddProfileDataLink(frame *data.Frame, datasourceUID, datasourceName, labelSelector, profileTypeID string) {
	idField, _ := frame.FieldByName("Id")
	if idField == nil {
		return
	}
	if idField.Config == nil {
		idField.Config = &data.FieldConfig{}
	}
	idField.Config.Links = append(idField.Config.Links, data.DataLink{
		Title: "View profile",
		Internal: &data.InternalDataLink{
			DatasourceUID:  datasourceUID,
			DatasourceName: datasourceName,
			Query: map[string]any{
				"queryType":         "profile",
				"labelSelector":     labelSelector,
				"profileTypeId":     profileTypeID,
				"profileIdSelector": []string{"${__value.raw}"},
				"groupBy":           []string{},
				"heatmapType":       "individual",
				"includeExemplars":  false,
				"includeHeatmap":    false,
			},
		},
	})
}
