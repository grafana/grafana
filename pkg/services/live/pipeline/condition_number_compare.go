package pipeline

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type NumberCompareConditionConfig struct {
	FieldName string  `json:"fieldName"`
	Op        string  `json:"op"`
	Value     float64 `json:"value"`
}

type NumberCompareCondition struct {
	config NumberCompareConditionConfig
}

func (f NumberCompareCondition) CheckCondition(_ context.Context, frame *data.Frame) (bool, error) {
	for _, field := range frame.Fields {
		// TODO: support other numeric types.
		if field.Name == f.config.FieldName && (field.Type() == data.FieldTypeNullableFloat64) {
			value, ok := field.At(0).(*float64)
			if !ok {
				return false, fmt.Errorf("unexpected value type: %T", field.At(0))
			}
			if value == nil {
				return false, nil
			}
			switch f.config.Op {
			case "gt":
				return *value > f.config.Value, nil
			case "gte":
				return *value >= f.config.Value, nil
			case "lte":
				return *value <= f.config.Value, nil
			case "lt":
				return *value < f.config.Value, nil
			default:
				return false, fmt.Errorf("unknown operator: %s", f.config.Op)
			}
		}
	}
	return false, nil
}

func NewNumberCompareCondition(config NumberCompareConditionConfig) *NumberCompareCondition {
	return &NumberCompareCondition{config: config}
}
