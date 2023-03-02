package backgroundsvcs

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/modules"
)

func TestBackgroundServiceRegistry_Run_Error(t *testing.T) {
	testErr := errors.New("boom")
	s := NewBackgroundServiceRegistry(&modules.MockModuleEngine{}, newTestService(nil, false), newTestService(testErr, false))
	err := s.run(context.Background())
	require.ErrorIs(t, err, testErr)
}

type testBackgroundService struct {
	started    chan struct{}
	runErr     error
	isDisabled bool
}

func newTestService(runErr error, disabled bool) *testBackgroundService {
	return &testBackgroundService{
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
