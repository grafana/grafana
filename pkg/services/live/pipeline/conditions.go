package pipeline

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ConditionChecker interface {
	CheckCondition(ctx context.Context, frame *data.Frame) (bool, error)
}

type Float64CompareCondition struct {
	FieldName string
	Op        string
	Value     float64
}

func (f Float64CompareCondition) CheckCondition(_ context.Context, frame *data.Frame) (bool, error) {
	for _, field := range frame.Fields {
		if field.Name == f.FieldName && (field.Type() == data.FieldTypeNullableFloat64) {
			value, ok := field.At(0).(*float64)
			if !ok {
				return false, fmt.Errorf("unexpected value type: %T", field.At(0))
			}
			if value != nil && *value >= f.Value {
				return true, nil
			}
		}
	}
	return false, nil
}

func NewFloat64CompareCondition(fieldName string, op string, value float64) *Float64CompareCondition {
	return &Float64CompareCondition{FieldName: fieldName, Op: op, Value: value}
}
