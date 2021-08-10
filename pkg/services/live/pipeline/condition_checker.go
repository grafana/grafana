package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ConditionChecker interface {
	CheckCondition(ctx context.Context, frame *data.Frame) (bool, error)
}
