package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// ConditionChecker checks conditions in context of data.Frame being processed.
type ConditionChecker interface {
	CheckCondition(ctx context.Context, frame *data.Frame) (bool, error)
}
