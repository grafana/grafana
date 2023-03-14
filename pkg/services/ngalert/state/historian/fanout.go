package historian

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/hashicorp/go-multierror"
)

type backend interface {
	Record(ctx context.Context, rule history_model.RuleMeta, states []state.StateTransition) <-chan error
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
		errCh <- combineErrors(errs...)
	}()
	return errCh
}

func combineErrors(errs ...error) error {
	var multi *multierror.Error
	for _, err := range errs {
		multi = multierror.Append(multi, err)
	}
	return multi
}
