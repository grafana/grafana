package state

import (
	"context"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type NoopPersister struct{}

func (n *NoopPersister) Async(_ context.Context, _ AlertInstancesProvider) {}
func (n *NoopPersister) Sync(_ context.Context, _ trace.Span, _ models.AlertRuleKeyWithGroup, _ StateTransitions) {
}

func NewNoopPersister() StatePersister {
	return &NoopPersister{}
}
