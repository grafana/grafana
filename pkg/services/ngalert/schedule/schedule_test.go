package schedule_test

import (
	"context"
	"fmt"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"

	"github.com/benbjohnson/clock"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var nilMetrics = metrics.NewMetrics(nil)

type evalAppliedInfo struct {
	alertDefKey models.AlertRuleKey
	now         time.Time
}

func TestWarmStateCache(t *testing.T) {
	evaluationTime, _ := time.Parse("2006-01-02", "2021-03-25")
	dbstore := tests.SetupTestEnv(t, 1)

	rule := tests.CreateTestAlertRule(t, dbstore, 600)

	expectedEntries := []*state.State{
		{
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			CacheId:      `[["test1","testValue1"]]`,
			Labels:       data.Labels{"test1": "testValue1"},
			State:        eval.Normal,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Normal},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
		}, {
			AlertRuleUID: rule.UID,
			OrgID:        rule.OrgID,
			CacheId:      `[["test2","testValue2"]]`,
			Labels:       data.Labels{"test2": "testValue2"},
			State:        eval.Alerting,
			Results: []state.Evaluation{
				{EvaluationTime: evaluationTime, EvaluationState: eval.Alerting},
			},
			StartsAt:           evaluationTime.Add(-1 * time.Minute),
			EndsAt:             evaluationTime.Add(1 * time.Minute),
			LastEvaluationTime: evaluationTime,
			Annotations:        map[string]string{"testAnnoKey": "testAnnoValue"},
		},
	}

	saveCmd1 := &models.SaveAlertInstanceCommand{
		RuleOrgID:         rule.OrgID,
		RuleUID:           rule.UID,
		Labels:            models.InstanceLabels{"test1": "testValue1"},
		State:             models.InstanceStateNormal,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
	}

	_ = dbstore.SaveAlertInstance(saveCmd1)

	saveCmd2 := &models.SaveAlertInstanceCommand{
		RuleOrgID:         rule.OrgID,
		RuleUID:           rule.UID,
		Labels:            models.InstanceLabels{"test2": "testValue2"},
		State:             models.InstanceStateFiring,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
	}
	_ = dbstore.SaveAlertInstance(saveCmd2)

	t.Cleanup(registry.ClearOverrides)

	schedCfg := schedule.SchedulerCfg{
		C:            clock.NewMock(),
		BaseInterval: time.Second,
		Logger:       log.New("ngalert cache warming test"),

		RuleStore:               dbstore,
		InstanceStore:           dbstore,
		Metrics:                 metrics.NewMetrics(prometheus.NewRegistry()),
		AdminConfigPollInterval: 10 * time.Minute, // do not poll in unit tests.
	}
	st := state.NewManager(schedCfg.Logger, nilMetrics, dbstore, dbstore)
	st.Warm()

	t.Run("instance cache has expected entries", func(t *testing.T) {
		for _, entry := range expectedEntries {
			cacheEntry, err := st.Get(entry.OrgID, entry.AlertRuleUID, entry.CacheId)
			require.NoError(t, err)

			if diff := cmp.Diff(entry, cacheEntry, cmpopts.IgnoreFields(state.State{}, "Results")); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
				t.FailNow()
			}
		}
	})
}

func TestAlertingTicker(t *testing.T) {
	dbstore := tests.SetupTestEnv(t, 1)
	t.Cleanup(registry.ClearOverrides)

	alerts := make([]*models.AlertRule, 0)

	// create alert rule with one second interval
	alerts = append(alerts, tests.CreateTestAlertRule(t, dbstore, 1))

	evalAppliedCh := make(chan evalAppliedInfo, len(alerts))
	stopAppliedCh := make(chan models.AlertRuleKey, len(alerts))

	mockedClock := clock.NewMock()
	baseInterval := time.Second

	schedCfg := schedule.SchedulerCfg{
		C:            mockedClock,
		BaseInterval: baseInterval,
		EvalAppliedFunc: func(alertDefKey models.AlertRuleKey, now time.Time) {
			evalAppliedCh <- evalAppliedInfo{alertDefKey: alertDefKey, now: now}
		},
		StopAppliedFunc: func(alertDefKey models.AlertRuleKey) {
			stopAppliedCh <- alertDefKey
		},
		RuleStore:               dbstore,
		InstanceStore:           dbstore,
		Logger:                  log.New("ngalert schedule test"),
		Metrics:                 metrics.NewMetrics(prometheus.NewRegistry()),
		AdminConfigPollInterval: 10 * time.Minute, // do not poll in unit tests.
	}
	st := state.NewManager(schedCfg.Logger, nilMetrics, dbstore, dbstore)
	sched := schedule.NewScheduler(schedCfg, nil, "http://localhost", st)

	ctx := context.Background()

	go func() {
		err := sched.Run(ctx)
		require.NoError(t, err)
	}()
	runtime.Gosched()

	expectedAlertRulesEvaluated := []models.AlertRuleKey{alerts[0].GetKey()}
	t.Run(fmt.Sprintf("on 1st tick alert rules: %s should be evaluated", concatenate(expectedAlertRulesEvaluated)), func(t *testing.T) {
		tick := advanceClock(t, mockedClock)
		assertEvalRun(t, evalAppliedCh, tick, expectedAlertRulesEvaluated...)
	})

	// change alert rule interval to three seconds
	var threeSecInterval int64 = 3
	alerts = append(alerts, tests.CreateTestAlertRule(t, dbstore, threeSecInterval))
	t.Logf("alert rule: %v added with interval: %d", alerts[1].GetKey(), threeSecInterval)

	expectedAlertRulesEvaluated = []models.AlertRuleKey{alerts[0].GetKey()}
	t.Run(fmt.Sprintf("on 2nd tick alert rule: %s should be evaluated", concatenate(expectedAlertRulesEvaluated)), func(t *testing.T) {
		tick := advanceClock(t, mockedClock)
		assertEvalRun(t, evalAppliedCh, tick, expectedAlertRulesEvaluated...)
	})

	expectedAlertRulesEvaluated = []models.AlertRuleKey{alerts[1].GetKey(), alerts[0].GetKey()}
	t.Run(fmt.Sprintf("on 3rd tick alert rules: %s should be evaluated", concatenate(expectedAlertRulesEvaluated)), func(t *testing.T) {
		tick := advanceClock(t, mockedClock)
		assertEvalRun(t, evalAppliedCh, tick, expectedAlertRulesEvaluated...)
	})

	expectedAlertRulesEvaluated = []models.AlertRuleKey{alerts[0].GetKey()}
	t.Run(fmt.Sprintf("on 4th tick alert rules: %s should be evaluated", concatenate(expectedAlertRulesEvaluated)), func(t *testing.T) {
		tick := advanceClock(t, mockedClock)
		assertEvalRun(t, evalAppliedCh, tick, expectedAlertRulesEvaluated...)
	})

	err := dbstore.DeleteAlertRuleByUID(alerts[0].OrgID, alerts[0].UID)
	require.NoError(t, err)
	t.Logf("alert rule: %v deleted", alerts[1].GetKey())

	expectedAlertRulesEvaluated = []models.AlertRuleKey{}
	t.Run(fmt.Sprintf("on 5th tick alert rules: %s should be evaluated", concatenate(expectedAlertRulesEvaluated)), func(t *testing.T) {
		tick := advanceClock(t, mockedClock)
		assertEvalRun(t, evalAppliedCh, tick, expectedAlertRulesEvaluated...)
	})
	expectedAlertRulesStopped := []models.AlertRuleKey{alerts[0].GetKey()}
	t.Run(fmt.Sprintf("on 5th tick alert rules: %s should be stopped", concatenate(expectedAlertRulesStopped)), func(t *testing.T) {
		assertStopRun(t, stopAppliedCh, expectedAlertRulesStopped...)
	})

	expectedAlertRulesEvaluated = []models.AlertRuleKey{alerts[1].GetKey()}
	t.Run(fmt.Sprintf("on 6th tick alert rules: %s should be evaluated", concatenate(expectedAlertRulesEvaluated)), func(t *testing.T) {
		tick := advanceClock(t, mockedClock)
		assertEvalRun(t, evalAppliedCh, tick, expectedAlertRulesEvaluated...)
	})

	// create alert rule with one second interval
	alerts = append(alerts, tests.CreateTestAlertRule(t, dbstore, 1))

	expectedAlertRulesEvaluated = []models.AlertRuleKey{alerts[2].GetKey()}
	t.Run(fmt.Sprintf("on 7th tick alert rules: %s should be evaluated", concatenate(expectedAlertRulesEvaluated)), func(t *testing.T) {
		tick := advanceClock(t, mockedClock)
		assertEvalRun(t, evalAppliedCh, tick, expectedAlertRulesEvaluated...)
	})
}

func assertEvalRun(t *testing.T, ch <-chan evalAppliedInfo, tick time.Time, keys ...models.AlertRuleKey) {
	timeout := time.After(time.Second)

	expected := make(map[models.AlertRuleKey]struct{}, len(keys))
	for _, k := range keys {
		expected[k] = struct{}{}
	}

	for {
		select {
		case info := <-ch:
			_, ok := expected[info.alertDefKey]
			t.Logf("alert rule: %v evaluated at: %v", info.alertDefKey, info.now)
			assert.True(t, ok)
			assert.Equal(t, tick, info.now)
			delete(expected, info.alertDefKey)
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

func assertStopRun(t *testing.T, ch <-chan models.AlertRuleKey, keys ...models.AlertRuleKey) {
	timeout := time.After(time.Second)

	expected := make(map[models.AlertRuleKey]struct{}, len(keys))
	for _, k := range keys {
		expected[k] = struct{}{}
	}

	for {
		select {
		case alertDefKey := <-ch:
			_, ok := expected[alertDefKey]
			t.Logf("alert rule: %v stopped", alertDefKey)
			assert.True(t, ok)
			delete(expected, alertDefKey)
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

func concatenate(keys []models.AlertRuleKey) string {
	s := make([]string, len(keys))
	for _, k := range keys {
		s = append(s, k.String())
	}
	return fmt.Sprintf("[%s]", strings.Join(s, ","))
}
