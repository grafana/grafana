package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// FrameConditionChecker checks conditions in context of data.Frame being processed.
type FrameConditionChecker interface {
	Type() string
	CheckFrameCondition(ctx context.Context, frame *data.Frame) (bool, error)
}
