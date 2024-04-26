package state

import (
	"context"

	"go.opentelemetry.io/otel/trace"
)

type NoopPersister struct{}

func (n *NoopPersister) Async(_ context.Context, _ *cache)                            {}
func (n *NoopPersister) Sync(_ context.Context, _ trace.Span, _, _ []StateTransition) {}

func NewNoopPersister() StatePersister {
	return &NoopPersister{}
}
