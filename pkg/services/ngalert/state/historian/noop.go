package historian

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

// NoOpHistorian is a state.Historian that does nothing with the resulting data, to be used in contexts where history is not needed.
type NoOpHistorian struct{}

func NewNopHistorian() *NoOpHistorian {
	return &NoOpHistorian{}
}

func (f *NoOpHistorian) RecordStatesAsync(ctx context.Context, _ *models.AlertRule, _ []state.StateTransition) {
}
