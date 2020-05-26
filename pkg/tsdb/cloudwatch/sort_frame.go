package cloudwatch

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// ByTime implements sort.Interface for data.Frame based on the frame's time field
type ByTime data.Frame

func (a ByTime) Len() int {
	if len(a.Fields) > 0 {
		return a.Fields[0].Len()
	}

	return 0
}

func (a ByTime) Swap(i, j int) {
	for _, field := range a.Fields {
		temp := field.At(i)
		field.Set(i, field.At(j))
		field.Set(j, temp)
	}
}
func (a ByTime) Less(i, j int) bool {
	var timeField *data.Field = nil
	for _, field := range a.Fields {
		if field.Type() == data.FieldTypeNullableTime {
			timeField = field
			break
		}
	}

	if timeField == nil {
		return false
	}

	return (timeField.At(i).(*time.Time)).Before(*timeField.At(j).(*time.Time))
}
