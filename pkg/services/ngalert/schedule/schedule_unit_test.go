package schedule

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/url"
	"sort"
	"sync"
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
	"github.com/grafana/grafana/pkg/services/mtdsclient"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/writer"
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
	cfgProvider := setting.ProvideService(&setting.Cfg{ExpressionsEnabled: true})
	evaluator := eval.NewEvaluatorFactory(
		setting.UnifiedAlertingSettings{},
		cacheServ,
		expr.ProvideService(
			cfgProvider,
			nil,
			nil,
			featuremgmt.WithFeatures(),
			nil,
			tracing.InitializeTracerForTest(),
			mtdsclient.NewNullMTDatasourceClientBuilder(),
		),
	)
	rrSet := setting.RecordingRuleSettings{
		Enabled: true,
	}

	schedCfg := SchedulerCfg{
		BaseInterval:      cfg.BaseInterval,
		C:                 mockedClock,
		AppURL:            appUrl,
		EvaluatorFactory:  evaluator,
		RuleStore:         ruleStore,
		Metrics:           testMetrics.GetSchedulerMetrics(),
		AlertSender:       notifier,
		RecordingRulesCfg: rrSet,
		Tracer:            testTracer,
		Log:               log.New("ngalert.scheduler"),
		FeatureToggles:    featuremgmt.WithFeatures(),
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
	gen := models.RuleGen
	// create alert rule under main org with one second interval
	alertRule1 := gen.With(gen.WithOrgID(mainOrgID), gen.WithInterval(cfg.BaseInterval), gen.WithTitle("rule-1")).GenerateRef()
	ruleStore.PutRule(ctx, alertRule1)

	folderWithRuleGroup1 := fmt.Sprintf("%s;%s", ruleStore.getNamespaceTitle(alertRule1.NamespaceUID), alertRule1.RuleGroup)

	t.Run("before 1st tick status should not be available", func(t *testing.T) {
		_, ok := sched.Status(alertRule1.GetKey())
		require.False(t, ok, "status for a rule should not be present before the scheduler has created it")
	})

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
			`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, by type and state.
        	            	# TYPE grafana_alerting_rule_group_rules gauge
        	            	grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[2]s",state="active",type="alerting"} 1
				`, alertRule1.OrgID, folderWithRuleGroup1)

		err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_group_rules")
		require.NoError(t, err)
	})

	t.Run("after 1st tick status for rule should be available", func(t *testing.T) {
		_, ok := sched.Status(alertRule1.GetKey())
		require.True(t, ok, "status for a rule that just evaluated was not available")
		// Interestingly, the rules in this test are randomised, and are sometimes invalid.
		// Therefore, we can't reliably assert anything about the actual health. It might be error, it might not, depending on randomness.
		// We are only testing that things were scheduled, not that the rule routine worked internally.
	})

	// add alert rule under main org with three base intervals
	alertRule2 := gen.With(gen.WithOrgID(mainOrgID), gen.WithInterval(3*cfg.BaseInterval), gen.WithTitle("rule-2")).GenerateRef()
	ruleStore.PutRule(ctx, alertRule2)

	folderWithRuleGroup2 := fmt.Sprintf("%s;%s", ruleStore.getNamespaceTitle(alertRule2.NamespaceUID), alertRule2.RuleGroup)

	t.Run("before 2nd tick status for rule should not be available", func(t *testing.T) {
		_, ok := sched.Status(alertRule2.GetKey())
		require.False(t, ok, "status for a rule should not be present before the scheduler has created it")
	})

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

	t.Run("after 2nd tick rule metrics should report two active alert rules in two groups", func(t *testing.T) {
		expectedMetric := fmt.Sprintf(
			`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, by type and state.
        	            	# TYPE grafana_alerting_rule_group_rules gauge
        	            	grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[2]s",state="active",type="alerting"} 1
        	            	grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[3]s",state="active",type="alerting"} 1
				`, alertRule1.OrgID, folderWithRuleGroup1, folderWithRuleGroup2)

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

	t.Run("after 3rd tick status for both rules should be available", func(t *testing.T) {
		_, ok := sched.Status(alertRule1.GetKey())
		require.True(t, ok, "status for a rule that just evaluated was not available")
		_, ok = sched.Status(alertRule2.GetKey())
		require.True(t, ok, "status for a rule that just evaluated was not available")
		// Interestingly, the rules in this test are randomised, and are sometimes invalid.
		// Therefore, we can't reliably assert anything about the actual health. It might be error, it might not, depending on randomness.
		// We are only testing that things were scheduled, not that the rule routine worked internally.
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

	t.Run("after 5th tick rule metrics should report one active and one paused alert rules in two groups", func(t *testing.T) {
		expectedMetric := fmt.Sprintf(
			`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, by type and state.
        	            	# TYPE grafana_alerting_rule_group_rules gauge
        	            	grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[2]s",state="paused",type="alerting"} 1
        	            	grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[3]s",state="active",type="alerting"} 1
				`, alertRule1.OrgID, folderWithRuleGroup1, folderWithRuleGroup2)

		err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_group_rules")
		require.NoError(t, err)
	})

	t.Run("after 5th tick status for both rules should be available regardless of pause state", func(t *testing.T) {
		_, ok := sched.Status(alertRule1.GetKey())
		require.True(t, ok, "status for a rule that just evaluated was not available")
		_, ok = sched.Status(alertRule2.GetKey())
		require.True(t, ok, "status for a rule that just evaluated was not available")
		// Interestingly, the rules in this test are randomised, and are sometimes invalid.
		// Therefore, we can't reliably assert anything about the actual health. It might be error, it might not, depending on randomness.
		// We are only testing that things were scheduled, not that the rule routine worked internally.
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

	t.Run("after 6th tick rule metrics should report two paused alert rules in two groups", func(t *testing.T) {
		expectedMetric := fmt.Sprintf(
			`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, by type and state.
        	            	# TYPE grafana_alerting_rule_group_rules gauge
        	            	grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[2]s",state="paused",type="alerting"} 1
        	            	grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[3]s",state="paused",type="alerting"} 1

				`, alertRule1.OrgID, folderWithRuleGroup1, folderWithRuleGroup2)
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

	t.Run("after 7th tick rule metrics should report two active alert rules in two groups", func(t *testing.T) {
		expectedMetric := fmt.Sprintf(
			`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, by type and state.
        	            	# TYPE grafana_alerting_rule_group_rules gauge
        	            	grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[2]s",state="active",type="alerting"} 1
        	            	grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[3]s",state="active",type="alerting"} 1
				`, alertRule1.OrgID, folderWithRuleGroup1, folderWithRuleGroup2)

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
			`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, by type and state.
        	            	# TYPE grafana_alerting_rule_group_rules gauge
        	            	grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[2]s",state="active",type="alerting"} 1
				`, alertRule1.OrgID, folderWithRuleGroup2)
		err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_group_rules")
		require.NoError(t, err)
	})

	t.Run("after 8th tick status for deleted rule should not be available", func(t *testing.T) {
		_, ok := sched.Status(alertRule1.GetKey())
		require.False(t, ok, "status for a rule that was deleted should not be available")
		_, ok = sched.Status(alertRule2.GetKey())
		require.True(t, ok, "status for a rule that just evaluated was not available")
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
	alertRule3 := gen.With(gen.WithOrgID(mainOrgID), gen.WithInterval(cfg.BaseInterval), gen.WithTitle("rule-3")).GenerateRef()
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
	t.Run("after 10th tick status for remaining rules should be available", func(t *testing.T) {
		_, ok := sched.Status(alertRule1.GetKey())
		require.False(t, ok, "status for a rule that was deleted should not be available")
		_, ok = sched.Status(alertRule2.GetKey())
		require.True(t, ok, "status for a rule that just evaluated was not available")
		_, ok = sched.Status(alertRule3.GetKey())
		require.True(t, ok, "status for a rule that just evaluated was not available")
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

	// Add a recording rule with 2 * base interval.
	recordingRule1 := gen.With(gen.WithOrgID(mainOrgID), gen.WithInterval(2*cfg.BaseInterval), gen.WithTitle("recording-1"), gen.WithAllRecordingRules()).GenerateRef()
	ruleStore.PutRule(ctx, recordingRule1)

	t.Run("on 12th tick recording rule and alert rules should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)

		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 3)
		require.Emptyf(t, stopped, "No rules are expected to be stopped")
		require.Emptyf(t, updated, "No rules are expected to be updated")
		contains := false
		for _, sch := range scheduled {
			if sch.rule.Title == recordingRule1.Title {
				contains = true
			}
		}
		require.True(t, contains, "Expected a scheduled rule with title %s but didn't get one, scheduled rules were %v", recordingRule1.Title, scheduled)
	})

	// Update the recording rule.
	recordingRule1 = models.CopyRule(recordingRule1)
	recordingRule1.Version++
	expectedUpdated := models.AlertRuleKeyWithVersion{
		Version:      recordingRule1.Version,
		AlertRuleKey: recordingRule1.GetKey(),
	}
	ruleStore.PutRule(context.Background(), recordingRule1)

	t.Run("on 13th tick recording rule should be updated", func(t *testing.T) {
		// It has 2 * base interval - so normally it would not have been scheduled for evaluation this tick.
		tick = tick.Add(cfg.BaseInterval)
		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 1)
		require.Emptyf(t, stopped, "No rules are expected to be stopped")
		require.Len(t, updated, 1)
		require.Equal(t, expectedUpdated, updated[0])
		assertScheduledContains(t, scheduled, alertRule3)
	})

	t.Run("on 14th tick both 1-tick alert rule and 2-tick recording rule should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)

		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 2)
		require.Emptyf(t, stopped, "No rules are expected to be stopped")
		require.Emptyf(t, updated, "No rules are expected to be updated")
		assertScheduledContains(t, scheduled, alertRule3)
		assertScheduledContains(t, scheduled, recordingRule1)
	})

	// Convert an alerting rule to a recording rule.
	models.ConvertToRecordingRule(alertRule3)
	alertRule3.Version++
	ruleStore.PutRule(ctx, alertRule3)

	t.Run("prior to 15th tick alertRule3 should still be scheduled as alerting rule", func(t *testing.T) {
		require.Equal(t, models.RuleTypeAlerting, sched.registry.rules[alertRule3.GetKey()].Type())
	})

	t.Run("on 15th tick converted rule and 3-tick alert rule should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)
		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 2)
		require.Emptyf(t, stopped, "No rules are expected to be stopped")
		// We never sent the Updated command to the restarted rule, so this should be empty.
		require.Emptyf(t, updated, "No rules are expected to be updated")

		assertScheduledContains(t, scheduled, alertRule2)
		assertScheduledContains(t, scheduled, alertRule3) // converted
		// Rule in registry should be updated to the correct type.
		require.Equal(t, models.RuleTypeRecording, sched.registry.rules[alertRule3.GetKey()].Type())
	})

	t.Run("on 16th tick converted rule and 2-tick recording rule should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)
		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 2)
		require.Emptyf(t, stopped, "No rules are expected to be stopped")
		require.Emptyf(t, updated, "No rules are expected to be updated")
		assertScheduledContains(t, scheduled, recordingRule1)
		assertScheduledContains(t, scheduled, alertRule3)
	})

	t.Run("on 17th tick all rules should be stopped", func(t *testing.T) {
		expectedToBeStopped, err := ruleStore.GetAlertRulesKeysForScheduling(ctx)
		require.NoError(t, err)

		// Remove all rules from store.
		ruleStore.rules = map[string]*models.AlertRule{}
		tick = tick.Add(cfg.BaseInterval)
		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)

		require.Emptyf(t, scheduled, "None rules should be scheduled")

		require.Len(t, stopped, len(expectedToBeStopped))

		require.Emptyf(t, updated, "No rules should be updated")
	})
	t.Run("after 17th tick no status should be available", func(t *testing.T) {
		_, ok := sched.Status(alertRule1.GetKey())
		require.False(t, ok, "status for a rule that was deleted should not be available")
		_, ok = sched.Status(alertRule2.GetKey())
		require.False(t, ok, "status for a rule that just evaluated was not available")
		_, ok = sched.Status(alertRule3.GetKey())
		require.False(t, ok, "status for a rule that just evaluated was not available")
	})

	t.Run("scheduled rules should be sorted", func(t *testing.T) {
		rules := gen.With(gen.WithOrgID(mainOrgID), gen.WithInterval(cfg.BaseInterval)).GenerateManyRef(10, 20)
		ruleStore.rules = map[string]*models.AlertRule{}
		ruleStore.PutRule(context.Background(), rules...)

		tick = tick.Add(cfg.BaseInterval)

		scheduled, stopped, updated := sched.processTick(ctx, dispatcherGroup, tick)
		require.Emptyf(t, stopped, "None rules are expected to be stopped")
		require.Emptyf(t, updated, "None rules are expected to be updated")
		require.Len(t, scheduled, len(rules), "All rules should be scheduled in this tick")
	})

	t.Run("sequence should be evaluated in the correct order", func(t *testing.T) {
		rules := gen.With(gen.WithOrgID(mainOrgID), gen.WithInterval(cfg.BaseInterval), gen.WithPrometheusOriginalRuleDefinition("def")).GenerateManyRef(10, 20)
		ruleStore.rules = map[string]*models.AlertRule{}
		ruleStore.PutRule(context.Background(), rules...)

		// Create tracking for evaluation order by group
		evalOrderByGroup := make(map[string][]string)
		mutex := sync.Mutex{}

		// Replace evalAppliedFunc to track order by group
		origEvalAppliedFunc := sched.evalAppliedFunc
		sched.evalAppliedFunc = func(alertDefKey models.AlertRuleKey, now time.Time) {
			// Find corresponding rule
			var rule *models.AlertRule
			for _, r := range rules {
				if r.GetKey() == alertDefKey {
					rule = r
					break
				}
			}

			if rule != nil {
				groupKey := fmt.Sprintf("%s;%s", ruleStore.getNamespaceTitle(rule.NamespaceUID), rule.RuleGroup)
				mutex.Lock()
				evalOrderByGroup[groupKey] = append(evalOrderByGroup[groupKey], rule.UID)
				mutex.Unlock()
			}

			origEvalAppliedFunc(alertDefKey, now)
		}
		defer func() {
			sched.evalAppliedFunc = origEvalAppliedFunc
		}()

		tick = tick.Add(cfg.BaseInterval)
		scheduled, _, _ := sched.processTick(ctx, dispatcherGroup, tick)
		require.NotEmpty(t, scheduled)

		// Wait for all evaluations to complete
		time.Sleep(100 * time.Millisecond)

		// Group rules by their group for expected order
		expectedOrderByGroup := make(map[string][]string)
		for _, rule := range rules {
			groupKey := fmt.Sprintf("%s;%s", ruleStore.getNamespaceTitle(rule.NamespaceUID), rule.RuleGroup)
			expectedOrderByGroup[groupKey] = append(expectedOrderByGroup[groupKey], rule.UID)
		}

		// Sort each group's rules by title
		for _, ruleUIDs := range expectedOrderByGroup {
			rulesByUID := make(map[string]*models.AlertRule)
			for _, rule := range rules {
				rulesByUID[rule.UID] = rule
			}

			sort.Slice(ruleUIDs, func(i, j int) bool {
				return rulesByUID[ruleUIDs[i]].Title < rulesByUID[ruleUIDs[j]].Title
			})
		}

		// Verify that rules within each group were evaluated in correct order
		for groupKey, expectedUIDs := range expectedOrderByGroup {
			actualUIDs, evaluated := evalOrderByGroup[groupKey]
			if !evaluated {
				// Some groups might not be evaluated during the test
				continue
			}

			if len(actualUIDs) > 1 { // Only check order for groups with multiple rules
				// Convert back to rule titles for clearer error messages
				rulesByUID := make(map[string]*models.AlertRule)
				for _, rule := range rules {
					rulesByUID[rule.UID] = rule
				}

				expectedTitles := make([]string, 0, len(expectedUIDs))
				for _, uid := range expectedUIDs {
					expectedTitles = append(expectedTitles, rulesByUID[uid].Title)
				}

				actualTitles := make([]string, 0, len(actualUIDs))
				for _, uid := range actualUIDs {
					actualTitles = append(actualTitles, rulesByUID[uid].Title)
				}

				assert.Equal(t, expectedTitles, actualTitles, "Rules in group %s were not evaluated in expected order", groupKey)
			}
		}
	})
}

func TestSchedule_updateRulesMetrics(t *testing.T) {
	ruleStore := newFakeRulesStore()
	reg := prometheus.NewPedanticRegistry()
	sch := setupScheduler(t, ruleStore, nil, reg, nil, nil, nil)
	ctx := context.Background()
	const firstOrgID int64 = 1
	const secondOrgID int64 = 2

	t.Run("grafana_alerting_rule_group_rules metric should reflect the current state", func(t *testing.T) {
		// Without any rules there are no metrics
		t.Run("it should not show metrics", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{})

			expectedMetric := ""
			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_group_rules")
			require.NoError(t, err)
		})

		alertRule1 := models.RuleGen.With(models.RuleGen.WithOrgID(firstOrgID)).GenerateRef()
		folderWithRuleGroup1 := fmt.Sprintf("%s;%s", ruleStore.getNamespaceTitle(alertRule1.NamespaceUID), alertRule1.RuleGroup)
		ruleStore.PutRule(ctx, alertRule1)

		_, err := sch.updateSchedulableAlertRules(ctx) // to update folderTitles
		require.NoError(t, err)

		t.Run("it should show one active rule in a single group", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRule1})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, by type and state.
								# TYPE grafana_alerting_rule_group_rules gauge
								grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[2]s",state="active", type="alerting"} 1
				`, alertRule1.OrgID, folderWithRuleGroup1)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_group_rules")
			require.NoError(t, err)
		})

		// Add a new rule alertRule2 and check that it is reflected in the metrics
		alertRule2 := models.RuleGen.With(models.RuleGen.WithOrgID(firstOrgID)).GenerateRef()
		folderWithRuleGroup2 := fmt.Sprintf("%s;%s", ruleStore.getNamespaceTitle(alertRule2.NamespaceUID), alertRule2.RuleGroup)
		ruleStore.PutRule(ctx, alertRule2)

		_, err = sch.updateSchedulableAlertRules(ctx) // to update folderTitles
		require.NoError(t, err)

		t.Run("it should show two active rules in two groups", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRule1, alertRule2})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, by type and state.
								# TYPE grafana_alerting_rule_group_rules gauge
								grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[2]s",state="active",type="alerting"} 1
                	            grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[3]s",state="active",type="alerting"} 1
				`, alertRule1.OrgID, folderWithRuleGroup1, folderWithRuleGroup2)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_group_rules")
			require.NoError(t, err)
		})

		// Now remove the alertRule2
		t.Run("it should show one active rules in one groups", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRule1, alertRule2})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_rule_group_rules The number of alert rules that are scheduled, by type and state.
								# TYPE grafana_alerting_rule_group_rules gauge
								grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[2]s",state="active",type="alerting"} 1
                	            grafana_alerting_rule_group_rules{org="%[1]d",rule_group="%[3]s",state="active",type="alerting"} 1
				`, alertRule1.OrgID, folderWithRuleGroup1, folderWithRuleGroup2)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_group_rules")
			require.NoError(t, err)
		})

		// and remove the alertRule1 so there should be no metrics now
		t.Run("it should show one active rules in one groups", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{})

			expectedMetric := ""
			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_group_rules")
			require.NoError(t, err)
		})
	})

	t.Run("prometheus_imported_rules metric should reflect the current state", func(t *testing.T) {
		// Without any imported rules there are no metrics
		t.Run("it should not show metrics", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{})

			expectedMetric := ""
			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_prometheus_imported_rules")
			require.NoError(t, err)
		})

		// The metric includes alert rules with either internal ConvertedPrometheusRuleLabel label,
		// or when AlertRule.HasPrometheusRuleDefinition() returns true.
		alertRule1 := models.RuleGen.With(
			models.RuleGen.WithOrgID(firstOrgID),
			models.RuleGen.WithPrometheusOriginalRuleDefinition("1"),
		).GenerateRef()

		alertRule2 := models.RuleGen.With(
			models.RuleGen.WithOrgID(firstOrgID),
			models.RuleGen.WithLabel(models.ConvertedPrometheusRuleLabel, "true"),
		).GenerateRef()

		alertRulePaused := models.RuleGen.With(
			models.RuleGen.WithOrgID(firstOrgID),
			models.RuleGen.WithPrometheusOriginalRuleDefinition("1"),
			models.RuleGen.WithIsPaused(true),
		).GenerateRef()

		t.Run("it should show two imported rules in a single org", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRule1, alertRule2, alertRulePaused})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_prometheus_imported_rules The number of rules imported from a Prometheus-compatible source.
								# TYPE grafana_alerting_prometheus_imported_rules gauge
								grafana_alerting_prometheus_imported_rules{org="%[1]d",state="active"} 2
								grafana_alerting_prometheus_imported_rules{org="%[1]d",state="paused"} 1
				`, alertRule1.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_prometheus_imported_rules")
			require.NoError(t, err)
		})

		alertRule3 := models.RuleGen.With(
			models.RuleGen.WithOrgID(secondOrgID),
			models.RuleGen.WithPrometheusOriginalRuleDefinition("1"),
		).GenerateRef()

		t.Run("it should show three imported rules in two orgs", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRule1, alertRule2, alertRule3, alertRulePaused})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_prometheus_imported_rules The number of rules imported from a Prometheus-compatible source.
								# TYPE grafana_alerting_prometheus_imported_rules gauge
								grafana_alerting_prometheus_imported_rules{org="%[1]d",state="active"} 2
								grafana_alerting_prometheus_imported_rules{org="%[1]d",state="paused"} 1
								grafana_alerting_prometheus_imported_rules{org="%[2]d",state="active"} 1
				`, firstOrgID, secondOrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_prometheus_imported_rules")
			require.NoError(t, err)
		})

		t.Run("after removing all rules it should not show any metrics", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{})

			expectedMetric := ""
			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_prometheus_imported_rules")
			require.NoError(t, err)
		})
	})

	t.Run("rule_groups metric should reflect the current state", func(t *testing.T) {
		const firstOrgID int64 = 1
		const secondOrgID int64 = 2

		// Without any rules there are no metrics
		t.Run("it should not show metrics", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{})

			expectedMetric := ""
			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_groups")
			require.NoError(t, err)
		})

		alertRule1 := models.RuleGen.With(models.RuleGen.WithOrgID(firstOrgID)).GenerateRef()

		t.Run("it should show one rule group in a single org", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRule1})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_rule_groups The number of alert rule groups
								# TYPE grafana_alerting_rule_groups gauge
								grafana_alerting_rule_groups{org="%[1]d"} 1
				`, alertRule1.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_groups")
			require.NoError(t, err)
		})

		alertRule2 := models.RuleGen.With(models.RuleGen.WithOrgID(secondOrgID)).GenerateRef()

		t.Run("it should show two rule groups in two orgs", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRule1, alertRule2})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_rule_groups The number of alert rule groups
								# TYPE grafana_alerting_rule_groups gauge
								grafana_alerting_rule_groups{org="%[1]d"} 1
								grafana_alerting_rule_groups{org="%[2]d"} 1
				`, alertRule1.OrgID, alertRule2.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_groups")
			require.NoError(t, err)
		})

		t.Run("when the first rule is removed it should show one rule group", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRule2})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_rule_groups The number of alert rule groups
								# TYPE grafana_alerting_rule_groups gauge
								grafana_alerting_rule_groups{org="%[1]d"} 1
				`, alertRule2.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_groups")
			require.NoError(t, err)
		})
	})

	t.Run("simple_routing_rules metric should reflect the current state", func(t *testing.T) {
		const firstOrgID int64 = 1
		const secondOrgID int64 = 2

		// Has no NotificationSettings, should not be in the metrics
		alertRuleWithoutNotificationSettings := models.RuleGen.With(
			models.RuleGen.WithOrgID(firstOrgID),
			models.RuleGen.WithNoNotificationSettings(),
		).GenerateRef()

		// Without any rules there are no metrics
		t.Run("it should not show metrics", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRuleWithoutNotificationSettings})

			expectedMetric := ""
			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_simple_routing_rules")
			require.NoError(t, err)
		})

		alertRule1 := models.RuleGen.With(
			models.RuleGen.WithOrgID(firstOrgID),
			models.RuleGen.WithNotificationSettingsGen(models.NotificationSettingsGen()),
		).GenerateRef()

		t.Run("it should show one rule in a single org", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRuleWithoutNotificationSettings, alertRule1})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_simple_routing_rules The number of alert rules using simplified routing.
								# TYPE grafana_alerting_simple_routing_rules gauge
								grafana_alerting_simple_routing_rules{org="%[1]d"} 1
				`, alertRule1.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_simple_routing_rules")
			require.NoError(t, err)
		})

		alertRule2 := models.RuleGen.With(
			models.RuleGen.WithOrgID(secondOrgID),
			models.RuleGen.WithNotificationSettingsGen(models.NotificationSettingsGen()),
		).GenerateRef()

		t.Run("it should show two rules in two orgs", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRuleWithoutNotificationSettings, alertRule1, alertRule2})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_simple_routing_rules The number of alert rules using simplified routing.
								# TYPE grafana_alerting_simple_routing_rules gauge
								grafana_alerting_simple_routing_rules{org="%[1]d"} 1
								grafana_alerting_simple_routing_rules{org="%[2]d"} 1
				`, alertRule1.OrgID, alertRule2.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_simple_routing_rules")
			require.NoError(t, err)
		})

		t.Run("after removing one of the rules it should show one present rule and two org", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRuleWithoutNotificationSettings, alertRule2})

			// Because alertRuleWithoutNotificationSettings.orgID is present,
			// the metric is also present but set to 0 because the org has no rules with NotificationSettings.
			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_simple_routing_rules The number of alert rules using simplified routing.
								# TYPE grafana_alerting_simple_routing_rules gauge
								grafana_alerting_simple_routing_rules{org="%[2]d"} 1
				`, alertRuleWithoutNotificationSettings.OrgID, alertRule2.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_simple_routing_rules")
			require.NoError(t, err)
		})

		t.Run("after removing all rules it should not show any metrics", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{})

			expectedMetric := ""
			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_simple_routing_rules")
			require.NoError(t, err)
		})
	})

	t.Run("simplified_editor_rules metric should reflect the current state", func(t *testing.T) {
		const firstOrgID int64 = 1
		const secondOrgID int64 = 2

		alertRuleWithAdvancedSettings := models.RuleGen.With(
			models.RuleGen.WithOrgID(firstOrgID),
			models.RuleGen.WithEditorSettingsSimplifiedNotificationsSection(false),
			models.RuleGen.WithEditorSettingsSimplifiedQueryAndExpressionsSection(false),
		).GenerateRef()

		// The rule does not have simplified editor enabled, should not be in the metrics
		t.Run("it should not show metrics", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRuleWithAdvancedSettings})

			expectedMetric := ""
			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_simplified_editor_rules")
			require.NoError(t, err)
		})

		alertRule1 := models.RuleGen.With(
			models.RuleGen.WithOrgID(firstOrgID),
			models.RuleGen.WithEditorSettingsSimplifiedQueryAndExpressionsSection(true),
			models.RuleGen.WithEditorSettingsSimplifiedNotificationsSection(true),
		).GenerateRef()

		t.Run("it should show one rule in a single org", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRuleWithAdvancedSettings, alertRule1})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_simplified_editor_rules The number of alert rules using simplified editor settings.
								# TYPE grafana_alerting_simplified_editor_rules gauge
								grafana_alerting_simplified_editor_rules{org="%[1]d",setting="simplified_notifications_section"} 1
								grafana_alerting_simplified_editor_rules{org="%[1]d",setting="simplified_query_and_expressions_section"} 1
				`, alertRule1.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_simplified_editor_rules")
			require.NoError(t, err)
		})

		alertRule2 := models.RuleGen.With(
			models.RuleGen.WithOrgID(secondOrgID),
			models.RuleGen.WithEditorSettingsSimplifiedNotificationsSection(false),
			models.RuleGen.WithEditorSettingsSimplifiedQueryAndExpressionsSection(true),
		).GenerateRef()

		t.Run("it should show two rules in two orgs", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRuleWithAdvancedSettings, alertRule1, alertRule2})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_simplified_editor_rules The number of alert rules using simplified editor settings.
								# TYPE grafana_alerting_simplified_editor_rules gauge
								grafana_alerting_simplified_editor_rules{org="%[1]d",setting="simplified_notifications_section"} 1
								grafana_alerting_simplified_editor_rules{org="%[1]d",setting="simplified_query_and_expressions_section"} 1
								grafana_alerting_simplified_editor_rules{org="%[2]d",setting="simplified_query_and_expressions_section"} 1
				`, alertRule1.OrgID, alertRule2.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_simplified_editor_rules")
			require.NoError(t, err)
		})

		t.Run("after removing one of the rules it should show one present rule and one org", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRuleWithAdvancedSettings, alertRule2})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_simplified_editor_rules The number of alert rules using simplified editor settings.
								# TYPE grafana_alerting_simplified_editor_rules gauge
								grafana_alerting_simplified_editor_rules{org="%d",setting="simplified_query_and_expressions_section"} 1
				`, alertRule2.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_simplified_editor_rules")
			require.NoError(t, err)
		})

		t.Run("after removing all rules it should not show any metrics", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{})

			expectedMetric := ""
			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_simplified_editor_rules")
			require.NoError(t, err)
		})
	})

	t.Run("rule_groups metric should reflect the current state", func(t *testing.T) {
		const firstOrgID int64 = 1
		const secondOrgID int64 = 2

		// Without any rules there are no metrics
		t.Run("it should not show metrics", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{})

			expectedMetric := ""
			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_groups")
			require.NoError(t, err)
		})

		alertRule1 := models.RuleGen.With(models.RuleGen.WithOrgID(firstOrgID)).GenerateRef()

		t.Run("it should show one rule group in a single org", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRule1})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_rule_groups The number of alert rule groups
								# TYPE grafana_alerting_rule_groups gauge
								grafana_alerting_rule_groups{org="%[1]d"} 1
				`, alertRule1.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_groups")
			require.NoError(t, err)
		})

		alertRule2 := models.RuleGen.With(models.RuleGen.WithOrgID(secondOrgID)).GenerateRef()

		t.Run("it should show two rule groups in two orgs", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRule1, alertRule2})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_rule_groups The number of alert rule groups
								# TYPE grafana_alerting_rule_groups gauge
								grafana_alerting_rule_groups{org="%[1]d"} 1
								grafana_alerting_rule_groups{org="%[2]d"} 1
				`, alertRule1.OrgID, alertRule2.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_groups")
			require.NoError(t, err)
		})

		t.Run("when the first rule is removed it should show one rule group", func(t *testing.T) {
			sch.updateRulesMetrics([]*models.AlertRule{alertRule2})

			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_rule_groups The number of alert rule groups
								# TYPE grafana_alerting_rule_groups gauge
								grafana_alerting_rule_groups{org="%[1]d"} 1
				`, alertRule2.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_groups")
			require.NoError(t, err)
		})
	})
}

type mockAlertRuleStopReasonProvider struct {
	mock.Mock
}

func (m *mockAlertRuleStopReasonProvider) FindReason(ctx context.Context, logger log.Logger, key models.AlertRuleKeyWithGroup) (error, error) {
	args := m.Called(ctx, logger, key)
	return args.Error(0), args.Error(1)
}

func TestSchedule_deleteAlertRule(t *testing.T) {
	ctx := context.Background()
	t.Run("when rule exists", func(t *testing.T) {
		t.Run("it should stop evaluation loop and remove the controller from registry", func(t *testing.T) {
			ruleStore := newFakeRulesStore()
			sch := setupScheduler(t, ruleStore, nil, nil, nil, nil, nil)
			ruleFactory := ruleFactoryFromScheduler(sch)
			rule := models.RuleGen.GenerateRef()
			ruleStore.PutRule(ctx, rule)
			key := rule.GetKey()
			info, _ := sch.registry.getOrCreate(ctx, rule, ruleFactory)

			sch.deleteAlertRule(ctx, key)

			require.ErrorIs(t, info.(*alertRule).ctx.Err(), errRuleDeleted)
			require.False(t, sch.registry.exists(key))
		})

		t.Run("it should call ruleStopReasonProvider if it is defined", func(t *testing.T) {
			mockReasonProvider := new(mockAlertRuleStopReasonProvider)
			expectedReason := errors.New("some rule deletion reason")
			mockReasonProvider.On("FindReason", mock.Anything, mock.Anything, mock.Anything).Return(expectedReason, nil)

			ruleStore := newFakeRulesStore()
			sch := setupScheduler(t, ruleStore, nil, nil, nil, nil, mockReasonProvider)
			ruleFactory := ruleFactoryFromScheduler(sch)
			rule := models.RuleGen.GenerateRef()
			ruleStore.PutRule(ctx, rule)
			key := rule.GetKey()
			info, _ := sch.registry.getOrCreate(ctx, rule, ruleFactory)

			_, err := sch.updateSchedulableAlertRules(ctx)
			require.NoError(t, err)

			sch.deleteAlertRule(ctx, key)

			mockReasonProvider.AssertCalled(t, "FindReason", mock.Anything, mock.Anything, rule.GetKeyWithGroup())

			require.ErrorIs(t, info.(*alertRule).ctx.Err(), expectedReason)
			require.False(t, sch.registry.exists(key))
		})

		t.Run("it should use the default reason if ruleStopReasonProvider does not return anything", func(t *testing.T) {
			mockReasonProvider := new(mockAlertRuleStopReasonProvider)
			mockReasonProvider.On("FindReason", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil)

			ruleStore := newFakeRulesStore()
			sch := setupScheduler(t, ruleStore, nil, nil, nil, nil, mockReasonProvider)
			ruleFactory := ruleFactoryFromScheduler(sch)
			rule := models.RuleGen.GenerateRef()
			ruleStore.PutRule(ctx, rule)
			key := rule.GetKey()
			info, _ := sch.registry.getOrCreate(ctx, rule, ruleFactory)

			_, err := sch.updateSchedulableAlertRules(ctx)
			require.NoError(t, err)

			sch.deleteAlertRule(ctx, key)

			mockReasonProvider.AssertCalled(t, "FindReason", mock.Anything, mock.Anything, rule.GetKeyWithGroup())

			require.ErrorIs(t, info.(*alertRule).ctx.Err(), errRuleDeleted)
			require.False(t, sch.registry.exists(key))
		})

		t.Run("it should still call ruleStopReasonProvider if the rule is not found in the registry", func(t *testing.T) {
			mockReasonProvider := new(mockAlertRuleStopReasonProvider)
			expectedReason := errors.New("some rule deletion reason")
			mockReasonProvider.On("FindReason", mock.Anything, mock.Anything, mock.Anything).Return(expectedReason, nil)

			// Don't create a ruleStore so that the rule will not be found in deleteAlertRule
			sch := setupScheduler(t, nil, nil, nil, nil, nil, mockReasonProvider)
			ruleFactory := ruleFactoryFromScheduler(sch)
			rule := models.RuleGen.GenerateRef()
			key := rule.GetKey()
			info, _ := sch.registry.getOrCreate(ctx, rule, ruleFactory)

			_, err := sch.updateSchedulableAlertRules(ctx)
			require.NoError(t, err)

			sch.deleteAlertRule(ctx, key)

			mockReasonProvider.AssertCalled(t, "FindReason", mock.Anything, mock.Anything, rule.GetKeyWithGroup())

			require.ErrorIs(t, info.(*alertRule).ctx.Err(), expectedReason)
			require.False(t, sch.registry.exists(key))
		})
	})

	t.Run("when rule does not exist", func(t *testing.T) {
		t.Run("should exit", func(t *testing.T) {
			sch := setupScheduler(t, nil, nil, nil, nil, nil, nil)
			key := models.GenerateRuleKey(rand.Int63())
			sch.deleteAlertRule(ctx, key)
		})
	})
}

func setupScheduler(t *testing.T, rs *fakeRulesStore, is *state.FakeInstanceStore, registry *prometheus.Registry, senderMock *SyncAlertsSenderMock, evalMock eval.EvaluatorFactory, ruleStopReasonProvider AlertRuleStopReasonProvider) *schedule {
	t.Helper()
	testTracer := tracing.InitializeTracerForTest()

	mockedClock := clock.NewMock()

	if rs == nil {
		rs = newFakeRulesStore()
	}

	if is == nil {
		is = &state.FakeInstanceStore{}
	}

	evaluator := evalMock
	cfgProvider := setting.ProvideService(&setting.Cfg{ExpressionsEnabled: true})
	if evalMock == nil {
		evaluator = eval.NewEvaluatorFactory(
			setting.UnifiedAlertingSettings{},
			&datasources.FakeCacheService{},
			expr.ProvideService(
				cfgProvider,
				nil,
				nil,
				featuremgmt.WithFeatures(),
				nil,
				tracing.InitializeTracerForTest(),
				mtdsclient.NewNullMTDatasourceClientBuilder(),
			),
		)
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
		RecordingRules: setting.RecordingRuleSettings{
			Enabled: true,
		},
	}

	fakeRecordingWriter := writer.FakeWriter{}

	schedCfg := SchedulerCfg{
		BaseInterval:           cfg.BaseInterval,
		MaxAttempts:            cfg.MaxAttempts,
		C:                      mockedClock,
		AppURL:                 appUrl,
		EvaluatorFactory:       evaluator,
		RuleStore:              rs,
		RecordingRulesCfg:      cfg.RecordingRules,
		Metrics:                m.GetSchedulerMetrics(),
		AlertSender:            senderMock,
		Tracer:                 testTracer,
		Log:                    log.New("ngalert.scheduler"),
		FeatureToggles:         featuremgmt.WithFeatures(),
		RecordingWriter:        fakeRecordingWriter,
		RuleStopReasonProvider: ruleStopReasonProvider,
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

func assertScheduledContains(t *testing.T, scheduled []readyToRunItem, rule *models.AlertRule) {
	t.Helper()

	contains := false
	for _, sch := range scheduled {
		if sch.rule.GetKey() == rule.GetKey() {
			contains = true
		}
	}
	require.True(t, contains, "Expected a scheduled rule with key %s title %s but didn't get one, scheduled rules were %v", rule.GetKey(), rule.Title, scheduled)
}
