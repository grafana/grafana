package schedule_test

import (
	"context"
	"fmt"
	"net/url"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/image"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
	"github.com/grafana/grafana/pkg/setting"
)

var testMetrics = metrics.NewNGAlert(prometheus.NewPedanticRegistry())

type evalAppliedInfo struct {
	alertDefKey models.AlertRuleKey
	now         time.Time
}

func TestWarmStateCache(t *testing.T) {
	evaluationTime, err := time.Parse("2006-01-02", "2021-03-25")
	require.NoError(t, err)
	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, 1)

	const mainOrgID int64 = 1
	rule := tests.CreateTestAlertRule(t, ctx, dbstore, 600, mainOrgID)

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

	_ = dbstore.SaveAlertInstance(ctx, saveCmd1)

	saveCmd2 := &models.SaveAlertInstanceCommand{
		RuleOrgID:         rule.OrgID,
		RuleUID:           rule.UID,
		Labels:            models.InstanceLabels{"test2": "testValue2"},
		State:             models.InstanceStateFiring,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
	}
	_ = dbstore.SaveAlertInstance(ctx, saveCmd2)

	cfg := setting.UnifiedAlertingSettings{
		BaseInterval:            time.Second,
		AdminConfigPollInterval: 10 * time.Minute, // do not poll in unit tests.
	}

	schedCfg := schedule.SchedulerCfg{
		Cfg:           cfg,
		C:             clock.NewMock(),
		Logger:        log.New("ngalert cache warming test"),
		RuleStore:     dbstore,
		InstanceStore: dbstore,
		Metrics:       testMetrics.GetSchedulerMetrics(),
	}
	st := state.NewManager(schedCfg.Logger, testMetrics.GetStateMetrics(), nil, dbstore, dbstore, &dashboards.FakeDashboardService{}, &image.NoopImageService{}, clock.NewMock())
	st.Warm(ctx)

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
	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, 1)

	alerts := make([]*models.AlertRule, 0)

	const mainOrgID int64 = 1
	// create alert rule under main org with one second interval
	alerts = append(alerts, tests.CreateTestAlertRule(t, ctx, dbstore, 1, mainOrgID))

	evalAppliedCh := make(chan evalAppliedInfo, len(alerts))
	stopAppliedCh := make(chan models.AlertRuleKey, len(alerts))

	mockedClock := clock.NewMock()

	cfg := setting.UnifiedAlertingSettings{
		BaseInterval:            time.Second,
		AdminConfigPollInterval: 10 * time.Minute, // do not poll in unit tests.
	}

	notifier := &schedule.AlertsSenderMock{}
	notifier.EXPECT().Send(mock.Anything, mock.Anything).Return()

	schedCfg := schedule.SchedulerCfg{
		Cfg: cfg,
		C:   mockedClock,
		EvalAppliedFunc: func(alertDefKey models.AlertRuleKey, now time.Time) {
			evalAppliedCh <- evalAppliedInfo{alertDefKey: alertDefKey, now: now}
		},
		StopAppliedFunc: func(alertDefKey models.AlertRuleKey) {
			stopAppliedCh <- alertDefKey
		},
		RuleStore:     dbstore,
		InstanceStore: dbstore,
		Logger:        log.New("ngalert schedule test"),
		Metrics:       testMetrics.GetSchedulerMetrics(),
		AlertSender:   notifier,
	}
	st := state.NewManager(schedCfg.Logger, testMetrics.GetStateMetrics(), nil, dbstore, dbstore, &dashboards.FakeDashboardService{}, &image.NoopImageService{}, clock.NewMock())
	appUrl := &url.URL{
		Scheme: "http",
		Host:   "localhost",
	}
	sched := schedule.NewScheduler(schedCfg, appUrl, st)

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

	// add alert rule under main org with three seconds interval
	var threeSecInterval int64 = 3
	alerts = append(alerts, tests.CreateTestAlertRule(t, ctx, dbstore, threeSecInterval, mainOrgID))
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

	key := alerts[0].GetKey()
	err := dbstore.DeleteAlertRulesByUID(ctx, alerts[0].OrgID, alerts[0].UID)
	require.NoError(t, err)
	t.Logf("alert rule: %v deleted", key)

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
	alerts = append(alerts, tests.CreateTestAlertRule(t, ctx, dbstore, 1, mainOrgID))

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
			if !ok {
				t.Fatalf("alert rule: %v should not have been evaluated at: %v", info.alertDefKey, info.now)
			}
			t.Logf("alert rule: %v evaluated at: %v", info.alertDefKey, info.now)
			assert.Equal(t, tick, info.now)
			delete(expected, info.alertDefKey)
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
