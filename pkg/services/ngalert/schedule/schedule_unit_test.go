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
	alertingModels "github.com/grafana/alerting/models"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	prometheusModel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
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

	notifier := &AlertsSenderMock{}
	notifier.EXPECT().Send(mock.Anything, mock.Anything).Return()

	appUrl := &url.URL{
		Scheme: "http",
		Host:   "localhost",
	}

	schedCfg := SchedulerCfg{
		BaseInterval: cfg.BaseInterval,
		C:            mockedClock,
		AppURL:       appUrl,
		RuleStore:    ruleStore,
		Metrics:      testMetrics.GetSchedulerMetrics(),
		AlertSender:  notifier,
		Tracer:       testTracer,
	}
	managerCfg := state.ManagerCfg{
		Metrics:                 testMetrics.GetStateMetrics(),
		ExternalURL:             nil,
		InstanceStore:           nil,
		Images:                  &state.NoopImageService{},
		Clock:                   mockedClock,
		Historian:               &state.FakeHistorian{},
		MaxStateSaveConcurrency: 1,
	}
	st := state.NewManager(managerCfg)

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

func TestSchedule_ruleRoutine(t *testing.T) {
	createSchedule := func(
		evalAppliedChan chan time.Time,
		senderMock *AlertsSenderMock,
	) (*schedule, *fakeRulesStore, *state.FakeInstanceStore, prometheus.Gatherer) {
		ruleStore := newFakeRulesStore()
		instanceStore := &state.FakeInstanceStore{}

		registry := prometheus.NewPedanticRegistry()
		sch := setupScheduler(t, ruleStore, instanceStore, registry, senderMock, nil)
		sch.evalAppliedFunc = func(key models.AlertRuleKey, t time.Time) {
			evalAppliedChan <- t
		}
		return sch, ruleStore, instanceStore, registry
	}

	// normal states do not include NoData and Error because currently it is not possible to perform any sensible test
	normalStates := []eval.State{eval.Normal, eval.Alerting, eval.Pending}
	allStates := [...]eval.State{eval.Normal, eval.Alerting, eval.Pending, eval.NoData, eval.Error}

	for _, evalState := range normalStates {
		// TODO rewrite when we are able to mock/fake state manager
		t.Run(fmt.Sprintf("when rule evaluation happens (evaluation state %s)", evalState), func(t *testing.T) {
			evalChan := make(chan *evaluation)
			evalAppliedChan := make(chan time.Time)
			sch, ruleStore, instanceStore, reg := createSchedule(evalAppliedChan, nil)

			rule := models.AlertRuleGen(withQueryForState(t, evalState))()
			ruleStore.PutRule(context.Background(), rule)
			folderTitle := ruleStore.getNamespaceTitle(rule.NamespaceUID)
			go func() {
				ctx, cancel := context.WithCancel(context.Background())
				t.Cleanup(cancel)
				_ = sch.ruleRoutine(ctx, rule.GetKey(), evalChan, make(chan ruleVersionAndPauseStatus))
			}()

			expectedTime := time.UnixMicro(rand.Int63())

			evalChan <- &evaluation{
				scheduledAt: expectedTime,
				rule:        rule,
				folderTitle: folderTitle,
			}

			actualTime := waitForTimeChannel(t, evalAppliedChan)
			require.Equal(t, expectedTime, actualTime)

			t.Run("it should add extra labels", func(t *testing.T) {
				states := sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
				for _, s := range states {
					assert.Equal(t, rule.UID, s.Labels[alertingModels.RuleUIDLabel])
					assert.Equal(t, rule.NamespaceUID, s.Labels[alertingModels.NamespaceUIDLabel])
					assert.Equal(t, rule.Title, s.Labels[prometheusModel.AlertNameLabel])
					assert.Equal(t, folderTitle, s.Labels[models.FolderTitleLabel])
				}
			})

			t.Run("it should process evaluation results via state manager", func(t *testing.T) {
				// TODO rewrite when we are able to mock/fake state manager
				states := sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
				require.Len(t, states, 1)
				s := states[0]
				require.Equal(t, rule.UID, s.AlertRuleUID)
				require.Len(t, s.Results, 1)
				var expectedStatus = evalState
				if evalState == eval.Pending {
					expectedStatus = eval.Alerting
				}
				require.Equal(t, expectedStatus.String(), s.Results[0].EvaluationState.String())
				require.Equal(t, expectedTime, s.Results[0].EvaluationTime)
			})
			t.Run("it should save alert instances to storage", func(t *testing.T) {
				// TODO rewrite when we are able to mock/fake state manager
				states := sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
				require.Len(t, states, 1)
				s := states[0]

				var cmd *models.AlertInstance
				for _, op := range instanceStore.RecordedOps {
					switch q := op.(type) {
					case models.AlertInstance:
						cmd = &q
					}
					if cmd != nil {
						break
					}
				}

				require.NotNil(t, cmd)
				t.Logf("Saved alert instances: %v", cmd)
				require.Equal(t, rule.OrgID, cmd.RuleOrgID)
				require.Equal(t, expectedTime, cmd.LastEvalTime)
				require.Equal(t, rule.UID, cmd.RuleUID)
				require.Equal(t, evalState.String(), string(cmd.CurrentState))
				require.Equal(t, s.Labels, data.Labels(cmd.Labels))
			})

			t.Run("it reports metrics", func(t *testing.T) {
				// duration metric has 0 values because of mocked clock that do not advance
				expectedMetric := fmt.Sprintf(
					`# HELP grafana_alerting_rule_evaluation_duration_seconds The duration for a rule to execute.
        	            	# TYPE grafana_alerting_rule_evaluation_duration_seconds histogram
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.005"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.01"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.025"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.05"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.1"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.25"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.5"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="1"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="2.5"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="5"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="10"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="25"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="50"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="100"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="+Inf"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_sum{org="%[1]d"} 0
        	            	grafana_alerting_rule_evaluation_duration_seconds_count{org="%[1]d"} 1
							# HELP grafana_alerting_rule_evaluation_failures_total The total number of rule evaluation failures.
        	            	# TYPE grafana_alerting_rule_evaluation_failures_total counter
        	            	grafana_alerting_rule_evaluation_failures_total{org="%[1]d"} 0
        	            	# HELP grafana_alerting_rule_evaluations_total The total number of rule evaluations.
        	            	# TYPE grafana_alerting_rule_evaluations_total counter
        	            	grafana_alerting_rule_evaluations_total{org="%[1]d"} 1
				`, rule.OrgID)

				err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_evaluation_duration_seconds", "grafana_alerting_rule_evaluations_total", "grafana_alerting_rule_evaluation_failures_total")
				require.NoError(t, err)
			})
		})
	}

	t.Run("should exit", func(t *testing.T) {
		t.Run("and not clear the state if parent context is cancelled", func(t *testing.T) {
			stoppedChan := make(chan error)
			sch, _, _, _ := createSchedule(make(chan time.Time), nil)

			rule := models.AlertRuleGen()()
			_ = sch.stateManager.ProcessEvalResults(context.Background(), sch.clock.Now(), rule, eval.GenerateResults(rand.Intn(5)+1, eval.ResultGen(eval.WithEvaluatedAt(sch.clock.Now()))), nil)
			expectedStates := sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
			require.NotEmpty(t, expectedStates)

			ctx, cancel := context.WithCancel(context.Background())
			go func() {
				err := sch.ruleRoutine(ctx, models.AlertRuleKey{}, make(chan *evaluation), make(chan ruleVersionAndPauseStatus))
				stoppedChan <- err
			}()

			cancel()
			err := waitForErrChannel(t, stoppedChan)
			require.NoError(t, err)
			require.Equal(t, len(expectedStates), len(sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)))
		})
		t.Run("and clean up the state if delete is cancellation reason ", func(t *testing.T) {
			stoppedChan := make(chan error)
			sch, _, _, _ := createSchedule(make(chan time.Time), nil)

			rule := models.AlertRuleGen()()
			_ = sch.stateManager.ProcessEvalResults(context.Background(), sch.clock.Now(), rule, eval.GenerateResults(rand.Intn(5)+1, eval.ResultGen(eval.WithEvaluatedAt(sch.clock.Now()))), nil)
			require.NotEmpty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))

			ctx, cancel := util.WithCancelCause(context.Background())
			go func() {
				err := sch.ruleRoutine(ctx, rule.GetKey(), make(chan *evaluation), make(chan ruleVersionAndPauseStatus))
				stoppedChan <- err
			}()

			cancel(errRuleDeleted)
			err := waitForErrChannel(t, stoppedChan)
			require.NoError(t, err)

			require.Empty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))
		})
	})

	t.Run("when a message is sent to update channel", func(t *testing.T) {
		rule := models.AlertRuleGen(withQueryForState(t, eval.Normal))()
		folderTitle := "folderName"
		ruleFp := ruleWithFolder{rule, folderTitle}.Fingerprint()

		evalChan := make(chan *evaluation)
		evalAppliedChan := make(chan time.Time)
		updateChan := make(chan ruleVersionAndPauseStatus)

		sender := AlertsSenderMock{}
		sender.EXPECT().Send(rule.GetKey(), mock.Anything).Return()

		sch, ruleStore, _, _ := createSchedule(evalAppliedChan, &sender)
		ruleStore.PutRule(context.Background(), rule)
		sch.schedulableAlertRules.set([]*models.AlertRule{rule}, map[string]string{rule.NamespaceUID: folderTitle})

		go func() {
			ctx, cancel := context.WithCancel(context.Background())
			t.Cleanup(cancel)
			_ = sch.ruleRoutine(ctx, rule.GetKey(), evalChan, updateChan)
		}()

		// init evaluation loop so it got the rule version
		evalChan <- &evaluation{
			scheduledAt: sch.clock.Now(),
			rule:        rule,
			folderTitle: folderTitle,
		}

		waitForTimeChannel(t, evalAppliedChan)

		// define some state
		states := make([]*state.State, 0, len(allStates))
		for _, s := range allStates {
			for i := 0; i < 2; i++ {
				states = append(states, &state.State{
					AlertRuleUID: rule.UID,
					CacheID:      util.GenerateShortUID(),
					OrgID:        rule.OrgID,
					State:        s,
					StartsAt:     sch.clock.Now(),
					EndsAt:       sch.clock.Now().Add(time.Duration(rand.Intn(25)+5) * time.Second),
					Labels:       rule.Labels,
				})
			}
		}
		sch.stateManager.Put(states)

		states = sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
		expectedToBeSent := 0
		for _, s := range states {
			if s.State == eval.Normal || s.State == eval.Pending {
				continue
			}
			expectedToBeSent++
		}
		require.Greaterf(t, expectedToBeSent, 0, "State manager was expected to return at least one state that can be expired")

		t.Run("should do nothing if version in channel is the same", func(t *testing.T) {
			updateChan <- ruleVersionAndPauseStatus{ruleFp, false}
			updateChan <- ruleVersionAndPauseStatus{ruleFp, false} // second time just to make sure that previous messages were handled

			actualStates := sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
			require.Len(t, actualStates, len(states))

			sender.AssertNotCalled(t, "Send", mock.Anything, mock.Anything)
		})

		t.Run("should clear the state and expire firing alerts if version in channel is greater", func(t *testing.T) {
			updateChan <- ruleVersionAndPauseStatus{ruleFp + 1, false}

			require.Eventually(t, func() bool {
				return len(sender.Calls) > 0
			}, 5*time.Second, 100*time.Millisecond)

			require.Empty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))
			sender.AssertNumberOfCalls(t, "Send", 1)
			args, ok := sender.Calls[0].Arguments[1].(definitions.PostableAlerts)
			require.Truef(t, ok, fmt.Sprintf("expected argument of function was supposed to be 'definitions.PostableAlerts' but got %T", sender.Calls[0].Arguments[1]))
			require.Len(t, args.PostableAlerts, expectedToBeSent)
		})
	})

	t.Run("when evaluation fails", func(t *testing.T) {
		rule := models.AlertRuleGen(withQueryForState(t, eval.Error))()
		rule.ExecErrState = models.ErrorErrState

		evalChan := make(chan *evaluation)
		evalAppliedChan := make(chan time.Time)

		sender := AlertsSenderMock{}
		sender.EXPECT().Send(rule.GetKey(), mock.Anything).Return()

		sch, ruleStore, _, reg := createSchedule(evalAppliedChan, &sender)
		ruleStore.PutRule(context.Background(), rule)

		go func() {
			ctx, cancel := context.WithCancel(context.Background())
			t.Cleanup(cancel)
			_ = sch.ruleRoutine(ctx, rule.GetKey(), evalChan, make(chan ruleVersionAndPauseStatus))
		}()

		evalChan <- &evaluation{
			scheduledAt: sch.clock.Now(),
			rule:        rule,
		}

		waitForTimeChannel(t, evalAppliedChan)

		t.Run("it should increase failure counter", func(t *testing.T) {
			// duration metric has 0 values because of mocked clock that do not advance
			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_rule_evaluation_duration_seconds The duration for a rule to execute.
        	            	# TYPE grafana_alerting_rule_evaluation_duration_seconds histogram
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.005"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.01"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.025"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.05"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.1"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.25"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.5"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="1"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="2.5"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="5"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="10"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="25"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="50"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="100"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="+Inf"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_sum{org="%[1]d"} 0
        	            	grafana_alerting_rule_evaluation_duration_seconds_count{org="%[1]d"} 1
							# HELP grafana_alerting_rule_evaluation_failures_total The total number of rule evaluation failures.
        	            	# TYPE grafana_alerting_rule_evaluation_failures_total counter
        	            	grafana_alerting_rule_evaluation_failures_total{org="%[1]d"} 1
        	            	# HELP grafana_alerting_rule_evaluations_total The total number of rule evaluations.
        	            	# TYPE grafana_alerting_rule_evaluations_total counter
        	            	grafana_alerting_rule_evaluations_total{org="%[1]d"} 1
				`, rule.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_evaluation_duration_seconds", "grafana_alerting_rule_evaluations_total", "grafana_alerting_rule_evaluation_failures_total")
			require.NoError(t, err)
		})

		t.Run("it should send special alert DatasourceError", func(t *testing.T) {
			sender.AssertNumberOfCalls(t, "Send", 1)
			args, ok := sender.Calls[0].Arguments[1].(definitions.PostableAlerts)
			require.Truef(t, ok, fmt.Sprintf("expected argument of function was supposed to be 'definitions.PostableAlerts' but got %T", sender.Calls[0].Arguments[1]))
			assert.Len(t, args.PostableAlerts, 1)
			assert.Equal(t, state.ErrorAlertName, args.PostableAlerts[0].Labels[prometheusModel.AlertNameLabel])
		})
	})

	t.Run("when there are alerts that should be firing", func(t *testing.T) {
		t.Run("it should call sender", func(t *testing.T) {
			// eval.Alerting makes state manager to create notifications for alertmanagers
			rule := models.AlertRuleGen(withQueryForState(t, eval.Alerting))()

			evalChan := make(chan *evaluation)
			evalAppliedChan := make(chan time.Time)

			sender := AlertsSenderMock{}
			sender.EXPECT().Send(rule.GetKey(), mock.Anything).Return()

			sch, ruleStore, _, _ := createSchedule(evalAppliedChan, &sender)
			ruleStore.PutRule(context.Background(), rule)

			go func() {
				ctx, cancel := context.WithCancel(context.Background())
				t.Cleanup(cancel)
				_ = sch.ruleRoutine(ctx, rule.GetKey(), evalChan, make(chan ruleVersionAndPauseStatus))
			}()

			evalChan <- &evaluation{
				scheduledAt: sch.clock.Now(),
				rule:        rule,
			}

			waitForTimeChannel(t, evalAppliedChan)

			sender.AssertNumberOfCalls(t, "Send", 1)
			args, ok := sender.Calls[0].Arguments[1].(definitions.PostableAlerts)
			require.Truef(t, ok, fmt.Sprintf("expected argument of function was supposed to be 'definitions.PostableAlerts' but got %T", sender.Calls[0].Arguments[1]))

			require.Len(t, args.PostableAlerts, 1)
		})
	})

	t.Run("when there are no alerts to send it should not call notifiers", func(t *testing.T) {
		rule := models.AlertRuleGen(withQueryForState(t, eval.Normal))()

		evalChan := make(chan *evaluation)
		evalAppliedChan := make(chan time.Time)

		sender := AlertsSenderMock{}
		sender.EXPECT().Send(rule.GetKey(), mock.Anything).Return()

		sch, ruleStore, _, _ := createSchedule(evalAppliedChan, &sender)
		ruleStore.PutRule(context.Background(), rule)

		go func() {
			ctx, cancel := context.WithCancel(context.Background())
			t.Cleanup(cancel)
			_ = sch.ruleRoutine(ctx, rule.GetKey(), evalChan, make(chan ruleVersionAndPauseStatus))
		}()

		evalChan <- &evaluation{
			scheduledAt: sch.clock.Now(),
			rule:        rule,
		}

		waitForTimeChannel(t, evalAppliedChan)

		sender.AssertNotCalled(t, "Send", mock.Anything, mock.Anything)

		require.NotEmpty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))
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

func setupScheduler(t *testing.T, rs *fakeRulesStore, is *state.FakeInstanceStore, registry *prometheus.Registry, senderMock *AlertsSenderMock, evalMock eval.EvaluatorFactory) *schedule {
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
		evaluator = eval.NewEvaluatorFactory(setting.UnifiedAlertingSettings{}, nil, expr.ProvideService(&setting.Cfg{ExpressionsEnabled: true}, nil, nil, &featuremgmt.FeatureManager{}, nil, tracing.InitializeTracerForTest()), &plugins.FakePluginStore{})
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
		senderMock = &AlertsSenderMock{}
		senderMock.EXPECT().Send(mock.Anything, mock.Anything).Return()
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
	}
	managerCfg := state.ManagerCfg{
		Metrics:                 m.GetStateMetrics(),
		ExternalURL:             nil,
		InstanceStore:           is,
		Images:                  &state.NoopImageService{},
		Clock:                   mockedClock,
		Historian:               &state.FakeHistorian{},
		MaxStateSaveConcurrency: 1,
	}
	st := state.NewManager(managerCfg)

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
