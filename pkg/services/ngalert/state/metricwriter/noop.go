package metricwriter

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/metricwriter/model"
)

type NoopWriter struct{}

func (w NoopWriter) Write(ctx context.Context, ruleMeta model.RuleMeta, states state.StateTransitions) <-chan error {
	errCh := make(chan error)
	close(errCh)
	return errCh
}
