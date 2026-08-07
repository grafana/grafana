package cloudmigrationimpl

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCancelInFlightCancelsRegisteredJob(t *testing.T) {
	t.Parallel()

	s := &Service{}
	started := make(chan struct{})
	finished := make(chan struct{})

	jobCtx, cancel := context.WithCancel(context.Background())
	s.cancelWG.Add(1)
	s.setCancelFunc(cancel)
	go func() {
		defer s.cancelWG.Done()
		defer s.clearCancelFunc()
		close(started)
		<-jobCtx.Done()
		close(finished)
	}()

	<-started
	require.NoError(t, s.cancelInFlight())

	select {
	case <-finished:
	case <-time.After(2 * time.Second):
		t.Fatal("job did not finish after cancel")
	}
}

func TestCancelInFlightNothingToCancel(t *testing.T) {
	t.Parallel()

	s := &Service{}
	err := s.cancelInFlight()
	require.Error(t, err)
	require.Contains(t, err.Error(), "nothing to cancel")
}

func TestCancelInFlightRace(t *testing.T) {
	t.Parallel()

	s := &Service{}
	jobCtx, cancel := context.WithCancel(context.Background())
	s.cancelWG.Add(1)
	s.setCancelFunc(cancel)
	go func() {
		defer s.cancelWG.Done()
		defer s.clearCancelFunc()
		<-jobCtx.Done()
	}()

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = s.cancelInFlight()
		}()
	}
	wg.Wait()
}
