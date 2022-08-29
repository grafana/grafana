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
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	prometheusModel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/image"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestSchedule_ruleRoutine(t *testing.T) {
	createSchedule := func(
		evalAppliedChan chan time.Time,
		senderMock *AlertsSenderMock,
	) (*schedule, *store.FakeRuleStore, *store.FakeInstanceStore, prometheus.Gatherer) {
		ruleStore := store.NewFakeRuleStore(t)
		instanceStore := &store.FakeInstanceStore{}

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

			go func() {
				ctx, cancel := context.WithCancel(context.Background())
				t.Cleanup(cancel)
				_ = sch.ruleRoutine(ctx, rule.GetKey(), evalChan, make(chan ruleVersion))
			}()

			expectedTime := time.UnixMicro(rand.Int63())

			evalChan <- &evaluation{
				scheduledAt: expectedTime,
				rule:        rule,
			}

			actualTime := waitForTimeChannel(t, evalAppliedChan)
			require.Equal(t, expectedTime, actualTime)

			t.Run("it should add extra labels", func(t *testing.T) {
				states := sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
				folder, _ := ruleStore.GetNamespaceByUID(context.Background(), rule.NamespaceUID, rule.OrgID, nil)
				for _, s := range states {
					assert.Equal(t, rule.UID, s.Labels[models.RuleUIDLabel])
					assert.Equal(t, rule.NamespaceUID, s.Labels[models.NamespaceUIDLabel])
					assert.Equal(t, rule.Title, s.Labels[prometheusModel.AlertNameLabel])
					assert.Equal(t, folder.Title, s.Labels[models.FolderTitleLabel])
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

				var cmd *models.SaveAlertInstanceCommand
				for _, op := range instanceStore.RecordedOps {
					switch q := op.(type) {
					case models.SaveAlertInstanceCommand:
						cmd = &q
					}
					if cmd != nil {
						break
					}
				}

				require.NotNil(t, cmd)
				t.Logf("Saved alert instance: %v", cmd)
				require.Equal(t, rule.OrgID, cmd.RuleOrgID)
				require.Equal(t, expectedTime, cmd.LastEvalTime)
				require.Equal(t, cmd.RuleUID, cmd.RuleUID)
				require.Equal(t, evalState.String(), string(cmd.State))
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
			_ = sch.stateManager.ProcessEvalResults(context.Background(), sch.clock.Now(), rule, eval.GenerateResults(rand.Intn(5)+1, eval.ResultGen()), nil)
			expectedStates := sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
			require.NotEmpty(t, expectedStates)

			ctx, cancel := context.WithCancel(context.Background())
			go func() {
				err := sch.ruleRoutine(ctx, models.AlertRuleKey{}, make(chan *evaluation), make(chan ruleVersion))
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
			_ = sch.stateManager.ProcessEvalResults(context.Background(), sch.clock.Now(), rule, eval.GenerateResults(rand.Intn(5)+1, eval.ResultGen()), nil)
			require.NotEmpty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))

			ctx, cancel := util.WithCancelCause(context.Background())
			go func() {
				err := sch.ruleRoutine(ctx, rule.GetKey(), make(chan *evaluation), make(chan ruleVersion))
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

		evalChan := make(chan *evaluation)
		evalAppliedChan := make(chan time.Time)
		updateChan := make(chan ruleVersion)

		sender := AlertsSenderMock{}
		sender.EXPECT().Send(rule.GetKey(), mock.Anything).Return()

		sch, ruleStore, _, _ := createSchedule(evalAppliedChan, &sender)
		ruleStore.PutRule(context.Background(), rule)

		go func() {
			ctx, cancel := context.WithCancel(context.Background())
			t.Cleanup(cancel)
			_ = sch.ruleRoutine(ctx, rule.GetKey(), evalChan, updateChan)
		}()

		// init evaluation loop so it got the rule version
		evalChan <- &evaluation{
			scheduledAt: sch.clock.Now(),
			rule:        rule,
		}

		waitForTimeChannel(t, evalAppliedChan)

		// define some state
		states := make([]*state.State, 0, len(allStates))
		for _, s := range allStates {
			for i := 0; i < 2; i++ {
				states = append(states, &state.State{
					AlertRuleUID: rule.UID,
					CacheId:      util.GenerateShortUID(),
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
		require.Greaterf(t, expectedToBeSent, 0, "State manger was expected to return at least one state that can be expired")

		t.Run("should do nothing if version in channel is the same", func(t *testing.T) {
			updateChan <- ruleVersion(rule.Version - 1)
			updateChan <- ruleVersion(rule.Version)
			updateChan <- ruleVersion(rule.Version) // second time just to make sure that previous messages were handled

			actualStates := sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
			require.Len(t, actualStates, len(states))

			sender.AssertNotCalled(t, "Send", mock.Anything, mock.Anything)
		})

		t.Run("should clear the state and expire firing alerts if version in channel is greater", func(t *testing.T) {
			updateChan <- ruleVersion(rule.Version + rand.Int63n(1000) + 1)

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
			_ = sch.ruleRoutine(ctx, rule.GetKey(), evalChan, make(chan ruleVersion))
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
			assert.Equal(t, ErrorAlertName, args.PostableAlerts[0].Labels[prometheusModel.AlertNameLabel])
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
				_ = sch.ruleRoutine(ctx, rule.GetKey(), evalChan, make(chan ruleVersion))
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
			_ = sch.ruleRoutine(ctx, rule.GetKey(), evalChan, make(chan ruleVersion))
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

func TestSchedule_UpdateAlertRule(t *testing.T) {
	t.Run("when rule exists", func(t *testing.T) {
		t.Run("it should call Update", func(t *testing.T) {
			sch := setupScheduler(t, nil, nil, nil, nil, nil)
			key := models.GenerateRuleKey(rand.Int63())
			info, _ := sch.registry.getOrCreateInfo(context.Background(), key)
			version := rand.Int63()
			go func() {
				sch.UpdateAlertRule(key, version)
			}()

			select {
			case v := <-info.updateCh:
				require.Equal(t, ruleVersion(version), v)
			case <-time.After(5 * time.Second):
				t.Fatal("No message was received on update channel")
			}
		})
		t.Run("should exit if rule is being stopped", func(t *testing.T) {
			sch := setupScheduler(t, nil, nil, nil, nil, nil)
			key := models.GenerateRuleKey(rand.Int63())
			info, _ := sch.registry.getOrCreateInfo(context.Background(), key)
			info.stop(nil)
			sch.UpdateAlertRule(key, rand.Int63())
		})
	})
	t.Run("when rule does not exist", func(t *testing.T) {
		t.Run("should exit", func(t *testing.T) {
			sch := setupScheduler(t, nil, nil, nil, nil, nil)
			key := models.GenerateRuleKey(rand.Int63())
			sch.UpdateAlertRule(key, rand.Int63())
		})
	})
}

func TestSchedule_DeleteAlertRule(t *testing.T) {
	t.Run("when rule exists", func(t *testing.T) {
		t.Run("it should stop evaluation loop and remove the controller from registry", func(t *testing.T) {
			sch := setupScheduler(t, nil, nil, nil, nil, nil)
			rule := models.AlertRuleGen()()
			key := rule.GetKey()
			info, _ := sch.registry.getOrCreateInfo(context.Background(), key)
			sch.DeleteAlertRule(key)
			require.ErrorIs(t, info.ctx.Err(), errRuleDeleted)
			require.False(t, sch.registry.exists(key))
		})
	})
	t.Run("when rule does not exist", func(t *testing.T) {
		t.Run("should exit", func(t *testing.T) {
			sch := setupScheduler(t, nil, nil, nil, nil, nil)
			key := models.GenerateRuleKey(rand.Int63())
			sch.DeleteAlertRule(key)
		})
	})
}

func setupScheduler(t *testing.T, rs *store.FakeRuleStore, is *store.FakeInstanceStore, registry *prometheus.Registry, senderMock *AlertsSenderMock, evalMock *eval.FakeEvaluator) *schedule {
	t.Helper()

	fakeAnnoRepo := store.NewFakeAnnotationsRepo()
	annotations.SetRepository(fakeAnnoRepo)
	mockedClock := clock.NewMock()
	logger := log.New("ngalert schedule test")

	if rs == nil {
		rs = store.NewFakeRuleStore(t)
	}

	if is == nil {
		is = &store.FakeInstanceStore{}
	}

	var evaluator eval.Evaluator = evalMock
	if evalMock == nil {
		evaluator = eval.NewEvaluator(&setting.Cfg{ExpressionsEnabled: true}, logger, nil, expr.ProvideService(&setting.Cfg{ExpressionsEnabled: true}, nil, nil))
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
		Cfg:         cfg,
		C:           mockedClock,
		Evaluator:   evaluator,
		RuleStore:   rs,
		Logger:      logger,
		Metrics:     m.GetSchedulerMetrics(),
		AlertSender: senderMock,
	}
	st := state.NewManager(schedCfg.Logger, m.GetStateMetrics(), nil, rs, is, &dashboards.FakeDashboardService{}, &image.NoopImageService{}, mockedClock)
	return NewScheduler(schedCfg, appUrl, st)
}

func withQueryForState(t *testing.T, evalResult eval.State) models.AlertRuleMutator {
	var expression string
	var forMultimplier int64 = 0
	switch evalResult {
	case eval.Normal:
		expression = `{
			"datasourceUid": "-100",
			"type":"math",
			"expression":"2 + 1 < 1"
		}`
	case eval.Pending, eval.Alerting:
		expression = `{
			"datasourceUid": "-100",
			"type":"math",
			"expression":"2 + 2 > 1"
		}`
		if evalResult == eval.Pending {
			forMultimplier = rand.Int63n(9) + 1
		}
	case eval.Error:
		expression = `{
			"datasourceUid": "-100",
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
				DatasourceUID: "-100",
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
