package state

import (
	"context"

	"go.opentelemetry.io/otel/trace"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type NoopPersister struct{}

func (n *NoopPersister) Async(_ context.Context, _ *cache)                            {}
func (n *NoopPersister) Sync(_ context.Context, _ trace.Span, _, _ []StateTransition) {}

func NewNoopPersister() StatePersister {
	return &NoopPersister{}
}

type NoopSender struct{}

func (s *NoopSender) Send(_ context.Context, _ ngmodels.AlertRuleKey, _ apimodels.PostableAlerts) {
}

func NewNoopSender() AlertsSender {
	return &NoopSender{}
}
