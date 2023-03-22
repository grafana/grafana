package backgroundsvcs

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBackgroundServiceRunner_Run_Error(t *testing.T) {
	testErr := errors.New("boom")
	registry := NewBackgroundServiceRegistry(newTestService("A", nil, false), newTestService("B", testErr, false))
	r := ProvideBackgroundServiceRunner(registry)

	err := r.run(context.Background())
	require.ErrorIs(t, err, testErr)
}

type testBackgroundService struct {
	name       string
	started    chan struct{}
	runErr     error
	isDisabled bool
}

func newTestService(name string, runErr error, disabled bool) *testBackgroundService {
	return &testBackgroundService{
		name:       name,
		started:    make(chan struct{}),
		runErr:     runErr,
		isDisabled: disabled,
	}
}

func (s *testBackgroundService) Run(ctx context.Context) error {
	if s.isDisabled {
		return fmt.Errorf("shouldn't run disabled service")
	}

	if s.runErr != nil {
		return s.runErr
	}
	close(s.started)
	<-ctx.Done()
	return ctx.Err()
}

func (s *testBackgroundService) IsDisabled() bool {
	return s.isDisabled
}
