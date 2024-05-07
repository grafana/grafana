package fields

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func NewFieldWithName(name string, fieldType data.FieldType, length int) *data.Field {
	field := data.NewFieldFromFieldType(fieldType, length)
	field.Name = name
	return field
}

func TimeField(length int) *data.Field {
	return NewFieldWithName(Time, data.FieldTypeTime, length)
}

func MetricField(metric string, length int) *data.Field {
	return NewFieldWithName(metric, data.FieldTypeFloat64, length)
}

func AggregationField(length int, name string) *data.Field {
	return NewFieldWithName(name, data.FieldTypeFloat64, length)
}
