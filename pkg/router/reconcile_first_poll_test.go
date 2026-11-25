package router

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

// errLoader is a RoutesLoader whose Load always fails with err.
type errLoader struct{ err error }

func (l errLoader) Load(context.Context) ([]Backend, error)       { return nil, l.err }
func (errLoader) Notify(context.Context) (<-chan struct{}, error) { return nil, nil }

// Waiting for a source's first poll keeps the router unready, but it is an
// expected startup state, so it must not count as a reconcile error.
func TestReconcileFirstPollPendingIsNotAnError(t *testing.T) {
	r := NewGrafanaRouter(errLoader{err: fmt.Errorf("%w: plugins, core", errFirstPollPending)}, nil)
	require.Error(t, r.reconcile(t.Context()), "the reconcile still reports the wait, so it is retried")
	require.Equal(t, uint64(1), r.reconciles.Load())
	require.Zero(t, r.reconcileErrors.Load())
	require.Error(t, r.Ready(t.Context()), "not ready until every source has polled")
}

// Any other load failure is still an error.
func TestReconcileLoadFailureIsStillAnError(t *testing.T) {
	r := NewGrafanaRouter(errLoader{err: errors.New("boom")}, nil)
	require.Error(t, r.reconcile(t.Context()))
	require.Equal(t, uint64(1), r.reconcileErrors.Load())
}
