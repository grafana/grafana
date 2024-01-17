package state

import (
	"context"

	"github.com/benbjohnson/clock"
	"go.opentelemetry.io/otel/trace"
)

type NoopPersister struct{}

func (n *NoopPersister) Async(_ context.Context, _ *clock.Ticker, _ *cache)           {}
func (n *NoopPersister) Sync(_ context.Context, _ trace.Span, _, _ []StateTransition) {}

func NewNoopPersister() StatePersister {
	return &NoopPersister{}
}
