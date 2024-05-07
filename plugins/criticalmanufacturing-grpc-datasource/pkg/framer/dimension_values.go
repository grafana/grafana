package framer

import (
	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"cmf/grafana-datamanager-datasource/pkg/framer/fields"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type DimensionValues struct {
	proto.ListDimensionValuesResponse
}

func (p DimensionValues) Frames() (data.Frames, error) {
	length := len(p.DimensionValues)
	labelField := fields.NewFieldWithName("label", data.FieldTypeString, length)
	nameField := fields.NewFieldWithName("value", data.FieldTypeString, length)
	descriptionField := fields.NewFieldWithName("description", data.FieldTypeString, length)

	frame := data.NewFrame("dimensions", labelField, nameField, descriptionField)

	for i, d := range p.DimensionValues {
		labelField.Set(i, d.Value)
		nameField.Set(i, d.Value)
		descriptionField.Set(i, d.Description)
	}

	return data.Frames{frame}, nil
}
