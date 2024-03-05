package schedule

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/url"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	datasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

type evalAppliedInfo struct {
	alertDefKey models.AlertRuleKey
	now         time.Time
}

func TestProcessTicks(t *testing.T) {
	testTracer := tracing.InitializeTracerForTest()
	reg := prometheus.NewPedanticRegistry()
	testMetrics := metrics.NewNGAlert(reg)
	ctx := context.Background()
	dispatcherGroup, ctx := errgroup.WithContext(ctx)

	ruleStore := newFakeRulesStore()

	cfg := setting.UnifiedAlertingSettings{
		BaseInterval:            1 * time.Second,
		AdminConfigPollInterval: 10 * time.Minute, // do not poll in unit tests.
	}

	const mainOrgID int64 = 1

	mockedClock := clock.NewMock()

	notifier := NewSyncAlertsSenderMock()
	notifier.EXPECT().Send(mock.Anything, mock.Anything, mock.Anything).Return()

	appUrl := &url.URL{
		Scheme: "http",
		Host:   "localhost",
	}

	cacheServ := &datasources.FakeCacheService{}
	evaluator := eval.NewEvaluatorFactory(setting.UnifiedAlertingSettings{}, cacheServ, expr.ProvideService(&setting.Cfg{ExpressionsEnabled: true}, nil, nil, &featuremgmt.FeatureManager{}, nil, tracing.InitializeTracerForTest()), &pluginstore.FakePluginStore{})

	schedCfg := SchedulerCfg{
		BaseInterval:     cfg.BaseInterval,
		C:                mockedClock,
		AppURL:           appUrl,
		EvaluatorFactory: evaluator,
		RuleStore:        ruleStore,
		Metrics:          testMetrics.GetSchedulerMetrics(),
		AlertSender:      notifier,
		Tracer:           testTracer,
		Log:              log.New("ngalert.scheduler"),
	}
	managerCfg := state.ManagerCfg{
		Metrics:       testMetrics.GetStateMetrics(),
		ExternalURL:   nil,
		InstanceStore: nil,
		Images:        &state.NoopImageService{},
		Clock:         mockedClock,
		Historian:     &state.FakeHistorian{},
		Tracer:        testTracer,
		Log:           log.New("ngalert.state.manager"),
	}
	st := state.NewManager(managerCfg, state.NewNoopPersister())

	sched := NewScheduler(schedCfg, st)

	evalAppliedCh := make(chan evalAppliedInfo, 1)
	stopAppliedCh := make(chan models.AlertRuleKey, 1)

	sched.evalAppliedFunc = func(alertDefKey models.AlertRuleKey, now time.Time) {
		evalAppliedCh <- evalAppliedInfo{alertDefKey: alertDefKey, now: now}
	}
	sched.stopAppliedFunc = func(alertDefKey models.AlertRuleKey) {
		stopAppliedCh <- alertDefKey
	}

	tick := time.Time{}

	// create alert rule under main org with one second interval
	alertRule1 := models.AlertRuleGen(models.WithOrgID(mainOrgID), models.WithInterval(cfg.BaseInterval), models.WithTitle("rule-1"))()
	ruleStore.PutRule(ctx, alertRule1)

	t.Run("on 1st tick alert rule should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)

		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 1)
		require.Equal(t, alertRule1, scheduled[0].rule)
		require.Equal(t, tick, scheduled[0].scheduledAt)
		require.Emptyf(t, stopped, "None rules are expected to be stopped")
		require.Emptyf(t, updated, "None rules are expected to be updated")
		assertEvalRun(t, evalAppliedCh, tick, alertRule1.GetKey())
	})

	t.Run("after 1st tick rule metrics should report one active alert rule", func(t *testing.T) {
		expectedMetric := fmt.Sprintf(
			`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, both active and paused.
        	            	# TYPE grafana_alerting_rule_group_rules gauge
        	            	grafana_alerting_rule_group_rules{org="%[1]d",state="active"} 1
        	            	grafana_alerting_rule_group_rules{org="%[1]d",state="paused"} 0
				`, alertRule1.OrgID)

		err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_group_rules")
		require.NoError(t, err)
	})

	// add alert rule under main org with three base intervals
	alertRule2 := models.AlertRuleGen(models.WithOrgID(mainOrgID), models.WithInterval(3*cfg.BaseInterval), models.WithTitle("rule-2"))()
	ruleStore.PutRule(ctx, alertRule2)

	t.Run("on 2nd tick first alert rule should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)
		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 1)
		require.Equal(t, alertRule1, scheduled[0].rule)
		require.Equal(t, tick, scheduled[0].scheduledAt)
		require.Emptyf(t, stopped, "None rules are expected to be stopped")
		require.Emptyf(t, updated, "None rules are expected to be updated")
		assertEvalRun(t, evalAppliedCh, tick, alertRule1.GetKey())
	})

	t.Run("after 2nd tick rule metrics should report two active alert rules", func(t *testing.T) {
		expectedMetric := fmt.Sprintf(
			`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, both active and paused.
        	            	# TYPE grafana_alerting_rule_group_rules gauge
        	            	grafana_alerting_rule_group_rules{org="%[1]d",state="active"} 2
        	            	grafana_alerting_rule_group_rules{org="%[1]d",state="paused"} 0
				`, alertRule1.OrgID)

		err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_group_rules")
		require.NoError(t, err)
	})

	t.Run("on 3rd tick two alert rules should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)
		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)
		require.Len(t, scheduled, 2)
		var keys []models.AlertRuleKey
		for _, item := range scheduled {
			keys = append(keys, item.rule.GetKey())
			require.Equal(t, tick, item.scheduledAt)
		}
		require.Contains(t, keys, alertRule1.GetKey())
		require.Contains(t, keys, alertRule2.GetKey())

		require.Emptyf(t, stopped, "None rules are expected to be stopped")
		require.Emptyf(t, updated, "None rules are expected to be updated")
		assertEvalRun(t, evalAppliedCh, tick, keys...)
	})

	t.Run("on 4th tick only one alert rule should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)
		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 1)
		require.Equal(t, alertRule1, scheduled[0].rule)
		require.Equal(t, tick, scheduled[0].scheduledAt)
		require.Emptyf(t, stopped, "None rules are expected to be stopped")
		require.Emptyf(t, updated, "None rules are expected to be updated")
		assertEvalRun(t, evalAppliedCh, tick, alertRule1.GetKey())
	})

	t.Run("on 5th tick an alert rule is paused (it still enters evaluation but it is early skipped)", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)

		alertRule1.IsPaused = true

		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 1)
		require.Equal(t, alertRule1, scheduled[0].rule)
		require.Equal(t, tick, scheduled[0].scheduledAt)
		require.Emptyf(t, stopped, "None rules are expected to be stopped")
		require.Emptyf(t, updated, "None rules are expected to be updated")
		assertEvalRun(t, evalAppliedCh, tick, alertRule1.GetKey())
	})

	t.Run("after 5th tick rule metrics should report one active and one paused alert rules", func(t *testing.T) {
		expectedMetric := fmt.Sprintf(
			`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, both active and paused.
        	            	# TYPE grafana_alerting_rule_group_rules gauge
        	            	grafana_alerting_rule_group_rules{org="%[1]d",state="active"} 1
        	            	grafana_alerting_rule_group_rules{org="%[1]d",state="paused"} 1
				`, alertRule1.OrgID)

		err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_group_rules")
		require.NoError(t, err)
	})

	t.Run("on 6th tick all alert rule are paused (it still enters evaluation but it is early skipped)", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)

		alertRule2.IsPaused = true

		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 2)
		var keys []models.AlertRuleKey
		for _, item := range scheduled {
			keys = append(keys, item.rule.GetKey())
			require.Equal(t, tick, item.scheduledAt)
		}
		require.Contains(t, keys, alertRule1.GetKey())
		require.Contains(t, keys, alertRule2.GetKey())

		require.Emptyf(t, stopped, "None rules are expected to be stopped")
		require.Emptyf(t, updated, "None rules are expected to be updated")
		assertEvalRun(t, evalAppliedCh, tick, keys...)
	})

	t.Run("after 6th tick rule metrics should report two paused alert rules", func(t *testing.T) {
		expectedMetric := fmt.Sprintf(
			`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, both active and paused.
        	            	# TYPE grafana_alerting_rule_group_rules gauge
        	            	grafana_alerting_rule_group_rules{org="%[1]d",state="active"} 0
        	            	grafana_alerting_rule_group_rules{org="%[1]d",state="paused"} 2
				`, alertRule1.OrgID)

		err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_group_rules")
		require.NoError(t, err)
	})

	t.Run("on 7th tick unpause all alert rules", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)

		alertRule1.IsPaused = false
		alertRule2.IsPaused = false

		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 1)
		require.Equal(t, alertRule1, scheduled[0].rule)
		require.Equal(t, tick, scheduled[0].scheduledAt)
		require.Emptyf(t, stopped, "None rules are expected to be stopped")
		require.Emptyf(t, updated, "None rules are expected to be updated")
		assertEvalRun(t, evalAppliedCh, tick, alertRule1.GetKey())
	})

	t.Run("after 7th tick rule metrics should report two active alert rules", func(t *testing.T) {
		expectedMetric := fmt.Sprintf(
			`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, both active and paused.
        	            	# TYPE grafana_alerting_rule_group_rules gauge
        	            	grafana_alerting_rule_group_rules{org="%[1]d",state="active"} 2
        	            	grafana_alerting_rule_group_rules{org="%[1]d",state="paused"} 0
				`, alertRule1.OrgID)

		err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_group_rules")
		require.NoError(t, err)
	})

	t.Run("on 8th tick deleted rule should not be evaluated but stopped", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)

		ruleStore.DeleteRule(alertRule1)

		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Empty(t, scheduled)
		require.Len(t, stopped, 1)
		require.Emptyf(t, updated, "None rules are expected to be updated")
		require.Contains(t, stopped, alertRule1.GetKey())

		assertStopRun(t, stopAppliedCh, alertRule1.GetKey())
	})

	t.Run("after 8th tick rule metrics should report one active alert rule", func(t *testing.T) {
		expectedMetric := fmt.Sprintf(
			`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, both active and paused.
        	            	# TYPE grafana_alerting_rule_group_rules gauge
        	            	grafana_alerting_rule_group_rules{org="%[1]d",state="active"} 1
        	            	grafana_alerting_rule_group_rules{org="%[1]d",state="paused"} 0
				`, alertRule1.OrgID)

		err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_group_rules")
		require.NoError(t, err)
	})

	t.Run("on 9th tick one alert rule should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)

		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 1)
		require.Equal(t, alertRule2, scheduled[0].rule)
		require.Equal(t, tick, scheduled[0].scheduledAt)
		require.Emptyf(t, stopped, "None rules are expected to be stopped")
		require.Emptyf(t, updated, "None rules are expected to be updated")
		assertEvalRun(t, evalAppliedCh, tick, alertRule2.GetKey())
	})

	// create alert rule with one base interval
	alertRule3 := models.AlertRuleGen(models.WithOrgID(mainOrgID), models.WithInterval(cfg.BaseInterval), models.WithTitle("rule-3"))()
	ruleStore.PutRule(ctx, alertRule3)

	t.Run("on 10th tick a new alert rule should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)

		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 1)
		require.Equal(t, alertRule3, scheduled[0].rule)
		require.Equal(t, tick, scheduled[0].scheduledAt)
		require.Emptyf(t, stopped, "None rules are expected to be stopped")
		require.Emptyf(t, updated, "None rules are expected to be updated")
		assertEvalRun(t, evalAppliedCh, tick, alertRule3.GetKey())
	})
	t.Run("on 11th tick rule2 should be updated", func(t *testing.T) {
		newRule2 := models.CopyRule(alertRule2)
		newRule2.Version++
		expectedUpdated := models.AlertRuleKeyWithVersion{
			Version:      newRule2.Version,
			AlertRuleKey: newRule2.GetKey(),
		}

		ruleStore.PutRule(context.Background(), newRule2)

		tick = tick.Add(cfg.BaseInterval)
		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 1)
		require.Equal(t, alertRule3, scheduled[0].rule)
		require.Equal(t, tick, scheduled[0].scheduledAt)

		require.Emptyf(t, stopped, "None rules are expected to be stopped")

		require.Len(t, updated, 1)
		require.Equal(t, expectedUpdated, updated[0])
	})
}

func TestSchedule_deleteAlertRule(t *testing.T) {
	t.Run("when rule exists", func(t *testing.T) {
		t.Run("it should stop evaluation loop and remove the controller from registry", func(t *testing.T) {
			sch := setupScheduler(t, nil, nil, nil, nil, nil)
			rule := models.AlertRuleGen()()
			key := rule.GetKey()
			info, _ := sch.registry.getOrCreateInfo(context.Background(), key)
			sch.deleteAlertRule(key)
			require.ErrorIs(t, info.ctx.Err(), errRuleDeleted)
			require.False(t, sch.registry.exists(key))
		})
	})
	t.Run("when rule does not exist", func(t *testing.T) {
		t.Run("should exit", func(t *testing.T) {
			sch := setupScheduler(t, nil, nil, nil, nil, nil)
			key := models.GenerateRuleKey(rand.Int63())
			sch.deleteAlertRule(key)
		})
	})
}

func setupScheduler(t *testing.T, rs *fakeRulesStore, is *state.FakeInstanceStore, registry *prometheus.Registry, senderMock *SyncAlertsSenderMock, evalMock eval.EvaluatorFactory) *schedule {
	t.Helper()
	testTracer := tracing.InitializeTracerForTest()

	mockedClock := clock.NewMock()

	if rs == nil {
		rs = newFakeRulesStore()
	}

	if is == nil {
		is = &state.FakeInstanceStore{}
	}

	var evaluator = evalMock
	if evalMock == nil {
		evaluator = eval.NewEvaluatorFactory(setting.UnifiedAlertingSettings{}, nil, expr.ProvideService(&setting.Cfg{ExpressionsEnabled: true}, nil, nil, &featuremgmt.FeatureManager{}, nil, tracing.InitializeTracerForTest()), &pluginstore.FakePluginStore{})
	}

	if registry == nil {
		registry = prometheus.NewPedanticRegistry()
	}
	m := metrics.NewNGAlert(registry)

	appUrl := &url.URL{
		Scheme: "http",
		Host:   "localhost",
	}

	if senderMock == nil {
		senderMock = NewSyncAlertsSenderMock()
		senderMock.EXPECT().Send(mock.Anything, mock.Anything, mock.Anything).Return()
	}

	cfg := setting.UnifiedAlertingSettings{
		BaseInterval: time.Second,
		MaxAttempts:  1,
	}

	schedCfg := SchedulerCfg{
		BaseInterval:     cfg.BaseInterval,
		MaxAttempts:      cfg.MaxAttempts,
		C:                mockedClock,
		AppURL:           appUrl,
		EvaluatorFactory: evaluator,
		RuleStore:        rs,
		Metrics:          m.GetSchedulerMetrics(),
		AlertSender:      senderMock,
		Tracer:           testTracer,
		Log:              log.New("ngalert.scheduler"),
	}
	managerCfg := state.ManagerCfg{
		Metrics:                 m.GetStateMetrics(),
		ExternalURL:             nil,
		InstanceStore:           is,
		Images:                  &state.NoopImageService{},
		Clock:                   mockedClock,
		Historian:               &state.FakeHistorian{},
		Tracer:                  testTracer,
		Log:                     log.New("ngalert.state.manager"),
		MaxStateSaveConcurrency: 1,
	}
	syncStatePersister := state.NewSyncStatePersisiter(log.New("ngalert.state.manager.perist"), managerCfg)
	st := state.NewManager(managerCfg, syncStatePersister)

	return NewScheduler(schedCfg, st)
}

func withQueryForState(t *testing.T, evalResult eval.State) models.AlertRuleMutator {
	var expression string
	var forMultimplier int64 = 0
	switch evalResult {
	case eval.Normal:
		expression = `{
			"datasourceUid": "__expr__",
			"type":"math",
			"expression":"2 + 1 < 1"
		}`
	case eval.Pending, eval.Alerting:
		expression = `{
			"datasourceUid": "__expr__",
			"type":"math",
			"expression":"2 + 2 > 1"
		}`
		if evalResult == eval.Pending {
			forMultimplier = rand.Int63n(9) + 1
		}
	case eval.Error:
		expression = `{
			"datasourceUid": "__expr__",
			"type":"math",
			"expression":"$A"
		}`
	default:
		require.Fail(t, fmt.Sprintf("Alert rule with desired evaluation result '%s' is not supported yet", evalResult))
	}

	return func(rule *models.AlertRule) {
		rule.Condition = "A"
		rule.Data = []models.AlertQuery{
			{
				DatasourceUID: expr.DatasourceUID,
				Model:         json.RawMessage(expression),
				RelativeTimeRange: models.RelativeTimeRange{
					From: models.Duration(5 * time.Hour),
					To:   models.Duration(3 * time.Hour),
				},
				RefID: "A",
			},
		}
		rule.For = time.Duration(rule.IntervalSeconds*forMultimplier) * time.Second
	}
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
