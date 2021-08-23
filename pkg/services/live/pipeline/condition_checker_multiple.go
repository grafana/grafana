package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ConditionType string

const (
	ConditionAll ConditionType = "all"
	ConditionAny ConditionType = "any"
)

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

func NewMultipleConditionChecker(conditionType ConditionType, conditions ...ConditionChecker) *MultipleConditionChecker {
	return &MultipleConditionChecker{Type: conditionType, Conditions: conditions}
}
