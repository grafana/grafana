package framer

import (
	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"cmf/grafana-datamanager-datasource/pkg/framer/fields"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type Metrics struct {
	proto.ListMetricsResponse
}

func (p Metrics) Frames() (data.Frames, error) {
	length := len(p.Metrics)
	labelField := fields.NewFieldWithName("label", data.FieldTypeString, length)
	nameField := fields.NewFieldWithName("value", data.FieldTypeString, length)
	descriptionField := fields.NewFieldWithName("description", data.FieldTypeString, length)

	frame := data.NewFrame("dimensions", labelField, nameField, descriptionField)

	for i, d := range p.Metrics {
		labelField.Set(i, d.Name)
		nameField.Set(i, d.Name)
		descriptionField.Set(i, d.Description)
	}

	return data.Frames{frame}, nil
}
