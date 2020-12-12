package ngalert

import (
	"context"
	"fmt"
	"runtime"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/benbjohnson/clock"
)

func TestAlertingTicker(t *testing.T) {
	ng := setupTestEnv(t)
	mockedClock := clock.NewMock()
	ng.schedule = newScheduler(mockedClock, time.Second, log.New("ngalert.schedule.test"), nil)

	alerts := make([]*AlertDefinition, 0)

	// create alert definition with zero interval (should never run)
	alerts = append(alerts, createTestAlertDefinition(t, ng, 0))

	// create alert definition with one second interval
	alerts = append(alerts, createTestAlertDefinition(t, ng, 1))

	// set the channel capacity to the number of the alerts created
	evalAppliedCh := make(chan int64, len(alerts))

	ng.schedule.evalApplied = func(alertDefID int64) {
		evalAppliedCh <- alertDefID
	}

	ctx := context.Background()
	go func() {
		err := ng.alertingTicker(ctx)
		require.NoError(t, err)
	}()
	runtime.Gosched()

	// this is required for unblocking Ticker.run() if the tick was too young
	err := ng.schedule.resetHeartbeatInterval(0 * time.Second)
	require.NoError(t, err)

	t.Run(fmt.Sprintf("on 1st tick only alert definition %d should be evaluated", alerts[1].ID), func(t *testing.T) {
		advanceClock(t, mockedClock)
		expectedAlertDefinitionsEvaluated := []int64{alerts[1].ID}
		mockedClock.AfterFunc(time.Second-time.Nanosecond, func() {
			assertEvalRun(t, evalAppliedCh, expectedAlertDefinitionsEvaluated...)
		})
	})

	// change alert definition interval to three seconds
	var threeSecInterval int64 = 3
	err = ng.updateAlertDefinition(&updateAlertDefinitionCommand{
		ID:                alerts[0].ID,
		IntervalInSeconds: &threeSecInterval,
	})
	require.NoError(t, err)
	t.Logf("alert definition: %d interval reset to: %d", alerts[0].ID, threeSecInterval)

	t.Run(fmt.Sprintf("on 2nd tick only alert definition %d should be evaluated", alerts[1].ID), func(t *testing.T) {
		advanceClock(t, mockedClock)
		expectedAlertDefinitionsEvaluated := []int64{alerts[1].ID}
		mockedClock.AfterFunc(time.Second-time.Nanosecond, func() {
			assertEvalRun(t, evalAppliedCh, expectedAlertDefinitionsEvaluated...)
		})
	})

	t.Run("on 3rd tick both alert definitions should be evaluated", func(t *testing.T) {
		advanceClock(t, mockedClock)
		expectedAlertDefinitionsEvaluated := []int64{alerts[1].ID, alerts[0].ID}
		mockedClock.AfterFunc(time.Second-time.Nanosecond, func() {
			assertEvalRun(t, evalAppliedCh, expectedAlertDefinitionsEvaluated...)
		})
	})

	t.Run(fmt.Sprintf("on 4th tick only alert definition %d should be evaluated", alerts[1].ID), func(t *testing.T) {
		advanceClock(t, mockedClock)
		expectedAlertDefinitionsEvaluated := []int64{alerts[1].ID}
		mockedClock.AfterFunc(time.Second-time.Nanosecond, func() {
			assertEvalRun(t, evalAppliedCh, expectedAlertDefinitionsEvaluated...)
		})
	})

	err = ng.deleteAlertDefinitionByID(&deleteAlertDefinitionByIDCommand{ID: alerts[1].ID})
	require.NoError(t, err)
	t.Logf("alert definition: %d deleted", alerts[1].ID)

	t.Run("on 5th tick no alert definitions should be evaluated", func(t *testing.T) {
		advanceClock(t, mockedClock)
		expectedAlertDefinitionsEvaluated := []int64{}
		mockedClock.AfterFunc(time.Second-time.Nanosecond, func() {
			assertEvalRun(t, evalAppliedCh, expectedAlertDefinitionsEvaluated...)
		})
	})

	t.Run(fmt.Sprintf("on 6th tick alert definition %d should be evaluated", alerts[0].ID), func(t *testing.T) {
		advanceClock(t, mockedClock)
		expectedAlertDefinitionsEvaluated := []int64{alerts[0].ID}
		mockedClock.AfterFunc(time.Second-time.Nanosecond, func() {
			assertEvalRun(t, evalAppliedCh, expectedAlertDefinitionsEvaluated...)
		})
	})
}

func assertEvalRun(t *testing.T, ch <-chan int64, ids ...int64) {
	expected := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		expected[id] = struct{}{}
	}

	for i := 0; i < len(ids); i++ {
		id := <-ch
		_, ok := expected[id]
		assert.True(t, ok)
		//t.Logf("alert definition: %d evaluated", id)
		delete(expected, id)
	}

	if len(expected) > 0 {
		assert.Fail(t, "Not expected: %v", expected)
	}
}

func advanceClock(t *testing.T, mockedClock *clock.Mock) {
	mockedClock.Add(time.Second)
	// t.Logf("Tick: %v", mockedClock.Now())
}
