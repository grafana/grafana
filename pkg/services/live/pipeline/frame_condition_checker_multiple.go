package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// MultipleFrameConditionChecker can check multiple conditions according to ConditionType.
type MultipleFrameConditionChecker struct {
	ConditionType ConditionType
	Conditions    []FrameConditionChecker
}

const FrameConditionCheckerTypeMultiple = "multiple"

func (c *MultipleFrameConditionChecker) Type() string {
	return FrameConditionCheckerTypeMultiple
}

func (c *MultipleFrameConditionChecker) CheckFrameCondition(ctx context.Context, frame *data.Frame) (bool, error) {
	for _, cond := range c.Conditions {
		ok, err := cond.CheckFrameCondition(ctx, frame)
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

// NewMultipleFrameConditionChecker creates new MultipleFrameConditionChecker.
func NewMultipleFrameConditionChecker(conditionType ConditionType, conditions ...FrameConditionChecker) *MultipleFrameConditionChecker {
	return &MultipleFrameConditionChecker{ConditionType: conditionType, Conditions: conditions}
}
