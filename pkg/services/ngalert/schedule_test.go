package ngalert

import (
	"context"
	"runtime"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/benbjohnson/clock"
)

func TestAlertingTicker(t *testing.T) {
	ng := setupTestEnv(t)
	mockedClock := clock.NewMock()
	evalAppliedCh := make(chan int64)
	ng.schedule = schedule{
		channelMap:  channelMap{definionCh: make(map[int64]definitionCh)},
		stop:        make(chan int64),
		maxAttempts: maxAttempts,
		clock:       mockedClock,
		evalApplied: func(alertDefID int64) {
			evalAppliedCh <- alertDefID
		},
	}

	// create alert definition with zero interval (should never run)
	initialAlertDef := createTestAlertDefinition(t, ng, 0)

	// create alert definition with one second interval
	alertDefWithOneSecInterval := createTestAlertDefinition(t, ng, 1)

	ticker := alerting.NewTicker(mockedClock.Now(), time.Second*0, mockedClock, 1)
	ctx := context.Background()
	go func() {
		err := ng.alertingTicker(ctx, ticker)
		require.NoError(t, err)
	}()
	runtime.Gosched()

	// this is required for unblocking Ticker.run() if the tick was too young
	ticker.ResetOffset(0 * time.Second)

	advanceClock(t, mockedClock)
	assertEvalRun(t, evalAppliedCh, alertDefWithOneSecInterval.ID)

	// change alert definition interval to three seconds
	var threeSecInterval int64 = 3
	err := ng.updateAlertDefinition(&updateAlertDefinitionCommand{
		ID:                initialAlertDef.ID,
		IntervalInSeconds: &threeSecInterval,
	})
	require.NoError(t, err)
	t.Logf("alert definition: %d interval reset to: %d", initialAlertDef.ID, threeSecInterval)

	// advance clock one second and trigger next tick
	advanceClock(t, mockedClock)
	assertEvalRun(t, evalAppliedCh, alertDefWithOneSecInterval.ID)

	advanceClock(t, mockedClock)
	step := 500 * time.Millisecond

	// wait enough for both alert definition evaluations
	mockedClock.AfterFunc(step, func() {
		assertEvalRun(t, evalAppliedCh, alertDefWithOneSecInterval.ID, initialAlertDef.ID)
	})

	advanceClock(t, mockedClock)
	assertEvalRun(t, evalAppliedCh, alertDefWithOneSecInterval.ID)

	err = ng.deleteAlertDefinitionByID(&deleteAlertDefinitionByIDCommand{ID: alertDefWithOneSecInterval.ID})
	require.NoError(t, err)
	t.Logf("alert definition: %d deleted", alertDefWithOneSecInterval.ID)

	advanceClock(t, mockedClock)
	assertEvalRun(t, evalAppliedCh)

	advanceClock(t, mockedClock)
	assertEvalRun(t, evalAppliedCh, initialAlertDef.ID)
}

// assertEvalRun blocks if does not receive the expected number of ids.
func assertEvalRun(t *testing.T, ch <-chan int64, ids ...int64) {
	received := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		received[id] = struct{}{}
	}

	for i := 0; i < len(ids); i++ {
		id := <-ch
		_, ok := received[id]
		assert.True(t, ok)
		t.Logf("alert definition: %d evaluated", id)
		delete(received, id)
	}

	if len(received) > 0 {
		assert.Fail(t, "Not received: %v", received)
	}
}

func advanceClock(t *testing.T, mockedClock *clock.Mock) {
	mockedClock.Add(time.Second)
	t.Logf("Tick: %v", mockedClock.Now())
}
