package exemplar

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type Exemplar struct {
	Id        string
	Value     float64
	Timestamp int64
}

func CreateExemplarFrame(labels map[string]string, exemplars []*Exemplar) *data.Frame {
	frame := data.NewFrame("exemplar")
	frame.Meta = &data.FrameMeta{
		DataTopic: data.DataTopicAnnotations,
	}
	fields := make([]*data.Field, 0, 3+len(labels))
	fields = append(fields,
		data.NewField("Time", nil, []time.Time{}),
		data.NewField("Value", labels, []float64{}),
		data.NewField("Id", nil, []string{}),
	)
	fields[2].Config = &data.FieldConfig{
		DisplayName: "Profile ID",
	}
	for name := range labels {
		fields = append(fields, data.NewField(name, nil, []string{}))
	}
	frame.Fields = fields

	for _, e := range exemplars {
		frame.AppendRow(time.UnixMilli(e.Timestamp), e.Value, e.Id)
		for name, value := range labels {
			field, _ := frame.FieldByName(name)
			if field != nil {
				field.Append(value)
			}
		}
	}
	return frame
}
