package historian

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

type Backend interface {
	Record(ctx context.Context, rule history_model.RuleMeta, states []state.StateTransition) <-chan error
	Query(ctx context.Context, query ngmodels.HistoryQuery) (*data.Frame, error)
}

// FanoutBackend is a state.Historian that records history to multiple other backends at once.
// Only one backend is used for reads. The backend selected for read traffic is called the primary and all others are called secondaries.
type FanoutBackend struct {
	targets []Backend
}

func NewFanoutBackend(primary Backend, secondaries ...Backend) *FanoutBackend {
	return &FanoutBackend{
		targets: append([]Backend{primary}, secondaries...),
	}
}

func (h *FanoutBackend) Record(ctx context.Context, rule history_model.RuleMeta, states []state.StateTransition) <-chan error {
	writes := make([]<-chan error, 0, len(h.targets))
	for _, b := range h.targets {
		writes = append(writes, b.Record(ctx, rule, states))
	}
	errCh := make(chan error, 1)
	go func() {
		defer close(errCh)
		errs := make([]error, 0)
		for _, ch := range writes {
			err := <-ch
			if err != nil {
				errs = append(errs, err)
			}
		}
		errCh <- errors.Join(errs...)
	}()
	return errCh
}

func (h *FanoutBackend) Query(ctx context.Context, query ngmodels.HistoryQuery) (*data.Frame, error) {
	return h.targets[0].Query(ctx, query)
}
