package ngalert

import (
	"context"
	"fmt"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/benbjohnson/clock"
)

type evalAppliedInfo struct {
	alertDefID int64
	now        time.Time
}

func TestAlertingTicker(t *testing.T) {
	ng := setupTestEnv(t)
	t.Cleanup(registry.ClearOverrides)

	mockedClock := clock.NewMock()
	ng.schedule = newScheduler(mockedClock, time.Second, log.New("ngalert.schedule.test"), nil)

	alerts := make([]*AlertDefinition, 0)

	// create alert definition with zero interval (should never run)
	alerts = append(alerts, createTestAlertDefinition(t, ng, 0))

	// create alert definition with one second interval
	alerts = append(alerts, createTestAlertDefinition(t, ng, 1))

	evalAppliedCh := make(chan evalAppliedInfo, len(alerts))

	ng.schedule.evalApplied = func(alertDefID int64, now time.Time) {
		evalAppliedCh <- evalAppliedInfo{alertDefID: alertDefID, now: now}
	}

	ctx := context.Background()
	go func() {
		err := ng.alertingTicker(ctx)
		require.NoError(t, err)
	}()
	runtime.Gosched()

	expectedAlertDefinitionsEvaluated := []int64{alerts[1].ID}
	t.Run(fmt.Sprintf("on 1st tick alert definitions: %s should be evaluated", concatenate(expectedAlertDefinitionsEvaluated)), func(t *testing.T) {
		tick := advanceClock(t, mockedClock)
		assertEvalRun(t, evalAppliedCh, tick, expectedAlertDefinitionsEvaluated...)
	})

	// change alert definition interval to three seconds
	var threeSecInterval int64 = 3
	err := ng.updateAlertDefinition(&updateAlertDefinitionCommand{
		ID:              alerts[0].ID,
		IntervalSeconds: &threeSecInterval,
		OrgID:           alerts[0].OrgID,
	})
	require.NoError(t, err)
	t.Logf("alert definition: %d interval reset to: %d", alerts[0].ID, threeSecInterval)

	expectedAlertDefinitionsEvaluated = []int64{alerts[1].ID}
	t.Run(fmt.Sprintf("on 2nd tick alert definition: %s should be evaluated", concatenate(expectedAlertDefinitionsEvaluated)), func(t *testing.T) {
		tick := advanceClock(t, mockedClock)
		assertEvalRun(t, evalAppliedCh, tick, expectedAlertDefinitionsEvaluated...)
	})

	expectedAlertDefinitionsEvaluated = []int64{alerts[1].ID, alerts[0].ID}
	t.Run(fmt.Sprintf("on 3rd tick alert definitions: %s should be evaluated", concatenate(expectedAlertDefinitionsEvaluated)), func(t *testing.T) {
		tick := advanceClock(t, mockedClock)
		assertEvalRun(t, evalAppliedCh, tick, expectedAlertDefinitionsEvaluated...)
	})

	expectedAlertDefinitionsEvaluated = []int64{alerts[1].ID}
	t.Run(fmt.Sprintf("on 4th tick alert definitions: %s should be evaluated", concatenate(expectedAlertDefinitionsEvaluated)), func(t *testing.T) {
		tick := advanceClock(t, mockedClock)
		assertEvalRun(t, evalAppliedCh, tick, expectedAlertDefinitionsEvaluated...)
	})

	err = ng.deleteAlertDefinitionByID(&deleteAlertDefinitionByIDCommand{ID: alerts[1].ID})
	require.NoError(t, err)
	t.Logf("alert definition: %d deleted", alerts[1].ID)

	expectedAlertDefinitionsEvaluated = []int64{}
	t.Run(fmt.Sprintf("on 5th tick alert definitions: %s should be evaluated", concatenate(expectedAlertDefinitionsEvaluated)), func(t *testing.T) {
		tick := advanceClock(t, mockedClock)
		assertEvalRun(t, evalAppliedCh, tick, expectedAlertDefinitionsEvaluated...)
	})

	expectedAlertDefinitionsEvaluated = []int64{alerts[0].ID}
	t.Run(fmt.Sprintf("on 6th tick alert definitions: %s should be evaluated", concatenate(expectedAlertDefinitionsEvaluated)), func(t *testing.T) {
		tick := advanceClock(t, mockedClock)
		assertEvalRun(t, evalAppliedCh, tick, expectedAlertDefinitionsEvaluated...)
	})

	// create alert definition with one second interval
	alerts = append(alerts, createTestAlertDefinition(t, ng, 1))

	expectedAlertDefinitionsEvaluated = []int64{alerts[2].ID}
	t.Run(fmt.Sprintf("on 7th tick alert definitions: %s should be evaluated", concatenate(expectedAlertDefinitionsEvaluated)), func(t *testing.T) {
		tick := advanceClock(t, mockedClock)
		assertEvalRun(t, evalAppliedCh, tick, expectedAlertDefinitionsEvaluated...)
	})
}

func assertEvalRun(t *testing.T, ch <-chan evalAppliedInfo, tick time.Time, ids ...int64) {
	timeout := time.After(time.Second)

	expected := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		expected[id] = struct{}{}
	}

	for {
		select {
		case info := <-ch:
			_, ok := expected[info.alertDefID]
			t.Logf("alert definition: %d evaluated at: %v", info.alertDefID, info.now)
			assert.True(t, ok)
			assert.Equal(t, tick, info.now)
			delete(expected, info.alertDefID)
			if len(expected) == 0 {
				return
			}
		case <-timeout:
			if len(expected) == 0 {
				return
			}
			t.Fatal("cycle has expired")
		}
	}
}

func advanceClock(t *testing.T, mockedClock *clock.Mock) time.Time {
	mockedClock.Add(time.Second)
	return mockedClock.Now()
	// t.Logf("Tick: %v", mockedClock.Now())
}

func concatenate(ids []int64) string {
	s := make([]string, len(ids))
	for _, id := range ids {
		s = append(s, strconv.FormatInt(id, 10))
	}
	return fmt.Sprintf("[%s]", strings.TrimLeft(strings.Join(s, ","), ","))
}
