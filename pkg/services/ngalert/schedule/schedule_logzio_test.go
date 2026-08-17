package schedule

// LOGZ.IO GRAFANA CHANGE :: APPZ-3028 Targeted state cache warm
//
// The warm decisions (mode flag, paused, staleness) live in the state package and are tested
// there. This test only proves the scheduler call site: ruleRoutine asks the state manager to
// warm right before each evaluation, and the evaluation itself refreshes the rule's activity.

import (
	"context"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

func TestSchedule_ruleRoutineTargetedWarm(t *testing.T) {
	countWarmQueries := func(is *state.FakeInstanceStore, key models.AlertRuleKey) int {
		count := 0
		for _, op := range is.RecordedOps() {
			if q, ok := op.(models.ListAlertInstancesQuery); ok && q.RuleOrgID == key.OrgID && q.RuleUID == key.UID {
				count++
			}
		}
		return count
	}

	ruleStore := newFakeRulesStore()
	instanceStore := &state.FakeInstanceStore{}
	sch := setupScheduler(t, ruleStore, instanceStore, nil, nil, nil)

	// Rebuild the state manager with targeted warm enabled: the mode flags live on the manager.
	managerCfg := state.ManagerCfg{
		InstanceStore:           instanceStore,
		Images:                  &state.NoopImageService{},
		Clock:                   sch.clock,
		Historian:               &state.FakeHistorian{},
		Tracer:                  tracing.InitializeTracerForTest(),
		Log:                     log.New("ngalert.state.manager"),
		MaxStateSaveConcurrency: 1,
		TargetedWarmEnabled:     true,
	}
	sch.stateManager = state.NewManager(managerCfg, state.NewSyncStatePersisiter(log.New("ngalert.state.manager.persist"), managerCfg))

	// Simulate the startup warm-up, which always runs before the scheduler in production. It
	// records the freshness baseline for rules never evaluated on this pod. The mocked clock is
	// moved off the epoch first: zero unix-nanoseconds is the never-warmed sentinel.
	mockClock := sch.clock.(*clock.Mock)
	mockClock.Add(time.Hour)
	sch.stateManager.Warm(context.Background(), &state.FakeRuleReader{})

	evalAppliedChan := make(chan time.Time)
	sch.evalAppliedFunc = func(key models.AlertRuleKey, t time.Time) {
		evalAppliedChan <- t
	}

	rule := models.AlertRuleGen(withQueryForState(t, eval.Normal))()
	ruleStore.PutRule(context.Background(), rule)
	sch.schedulableAlertRules.update(rule)

	evalChan := make(chan *evaluation)
	go func() {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)
		_ = sch.ruleRoutine(ctx, rule.GetKey(), evalChan, make(chan ruleVersionAndPauseStatus))
	}()

	sendEval := func() {
		evalChan <- &evaluation{
			scheduledAt: sch.clock.Now(),
			rule:        rule,
			folderTitle: "folder",
		}
		waitForTimeChannel(t, evalAppliedChan)
	}

	// First evaluation right after startup: the startup warm-up covers it, no per-rule query.
	sendEval()
	require.Equal(t, 0, countWarmQueries(instanceStore, rule.GetKey()), "first evaluation right after startup must not warm")

	mockClock.Add(state.TargetedWarmReloadAfter + time.Minute)
	sendEval()
	require.Equal(t, 1, countWarmQueries(instanceStore, rule.GetKey()), "an evaluation after a gap must warm")

	mockClock.Add(time.Minute)
	sendEval()
	require.Equal(t, 1, countWarmQueries(instanceStore, rule.GetKey()), "an evaluation within the reload window must not warm")

	mockClock.Add(state.TargetedWarmReloadAfter + time.Minute)
	sendEval()
	require.Equal(t, 2, countWarmQueries(instanceStore, rule.GetKey()), "another gap must warm again")
}

// LOGZ.IO GRAFANA CHANGE :: End
