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
	ConditionType ConditionType
	Conditions    []ConditionChecker
}

const ConditionCheckerTypeMultiple = "multiple"

func (c *MultipleConditionChecker) Type() string {
	return ConditionCheckerTypeMultiple
}

func (c *MultipleConditionChecker) CheckCondition(ctx context.Context, frame *data.Frame) (bool, error) {
	for _, cond := range c.Conditions {
		ok, err := cond.CheckCondition(ctx, frame)
		if err != nil {
			return false, err
		}
		if ok && c.ConditionType == ConditionAny {
			return true, nil
		}
		if !ok && c.ConditionType == ConditionAll {
			return false, nil
		}
	}
	if c.ConditionType == ConditionAny {
		return false, nil
	}
	return true, nil
}

// NewMultipleConditionChecker creates new MultipleConditionChecker.
func NewMultipleConditionChecker(conditionType ConditionType, conditions ...ConditionChecker) *MultipleConditionChecker {
	return &MultipleConditionChecker{ConditionType: conditionType, Conditions: conditions}
}
