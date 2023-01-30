package historian

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

// NoOpHistorian is a state.Historian that does nothing with the resulting data, to be used in contexts where history is not needed.
type NoOpHistorian struct{}

func NewNopHistorian() *NoOpHistorian {
	return &NoOpHistorian{}
}

func (f *NoOpHistorian) RecordStatesAsync(ctx context.Context, _ history_model.RuleMeta, _ []state.StateTransition) <-chan error {
	errCh := make(chan error)
	close(errCh)
	return errCh
}
