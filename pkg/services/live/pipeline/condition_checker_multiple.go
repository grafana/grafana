package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// ConditionType represents multiple condition operator type.
type ConditionType string

const (
	ConditionAll ConditionType = "all"
	ConditionAny ConditionType = "any"
)

// MultipleConditionChecker can check multiple conditions according to ConditionType.
type MultipleConditionChecker struct {
	Type       ConditionType
	Conditions []ConditionChecker
}

func (m MultipleConditionChecker) CheckCondition(ctx context.Context, frame *data.Frame) (bool, error) {
	for _, c := range m.Conditions {
		ok, err := c.CheckCondition(ctx, frame)
		if err != nil {
			return false, err
		}
		if ok && m.Type == ConditionAny {
			return true, nil
		}
		if !ok && m.Type == ConditionAll {
			return false, nil
		}
	}
	if m.Type == ConditionAny {
		return false, nil
	}
	return true, nil
}

// NewMultipleConditionChecker creates new MultipleConditionChecker.
func NewMultipleConditionChecker(conditionType ConditionType, conditions ...ConditionChecker) *MultipleConditionChecker {
	return &MultipleConditionChecker{Type: conditionType, Conditions: conditions}
}
