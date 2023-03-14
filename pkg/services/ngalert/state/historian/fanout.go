package historian

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

type backend interface {
	Record(ctx context.Context, rule history_model.RuleMeta, states []state.StateTransition) <-chan error
	Query(ctx context.Context, query ngmodels.HistoryQuery) (*data.Frame, error)
}

type FanoutBackend struct {
	targets []backend
}

func NewFanoutBackend(primary backend, secondaries ...backend) *FanoutBackend {
	return &FanoutBackend{
		targets: append([]backend{primary}, secondaries...),
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
