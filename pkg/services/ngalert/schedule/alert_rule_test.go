package schedule

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	prometheusModel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	alertingModels "github.com/grafana/alerting/models"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/util"
)

func TestAlertRule(t *testing.T) {
	gen := models.RuleGen
	type evalResponse struct {
		success     bool
		droppedEval *Evaluation
	}

	t.Run("when rule evaluation is not stopped", func(t *testing.T) {
		t.Run("update should send to updateCh", func(t *testing.T) {
			r := blankRuleForTests(context.Background(), models.GenerateRuleKeyWithGroup(1))
			resultCh := make(chan bool)
			go func() {
				resultCh <- r.Update(&Evaluation{rule: gen.With(gen.WithIsPaused(false)).GenerateRef()})
			}()
			select {
			case <-r.updateCh:
				require.True(t, <-resultCh)
			case <-time.After(5 * time.Second):
				t.Fatal("No message was received on update channel")
			}
		})
		t.Run("update should drop any concurrent sending to updateCh", func(t *testing.T) {
			r := blankRuleForTests(context.Background(), models.GenerateRuleKeyWithGroup(1))
			version1 := &Evaluation{rule: gen.With(gen.WithIsPaused(false)).GenerateRef()}
			version2 := &Evaluation{rule: gen.With(gen.WithIsPaused(false)).GenerateRef()}

			wg := sync.WaitGroup{}
			wg.Add(1)
			go func() {
				wg.Done()
				r.Update(version1)
				wg.Done()
			}()
			wg.Wait()
			wg.Add(2) // one when time1 is sent, another when go-routine for time2 has started
			go func() {
				wg.Done()
				r.Update(version2)
			}()
			wg.Wait() // at this point tick 1 has already been dropped
			select {
			case version := <-r.updateCh:
				require.Equal(t, version2, version)
			case <-time.After(5 * time.Second):
				t.Fatal("No message was received on eval channel")
			}
		})
		t.Run("eval should send to evalCh", func(t *testing.T) {
			ruleSpec := gen.GenerateRef()
			r := blankRuleForTests(context.Background(), ruleSpec.GetKeyWithGroup())
			expected := time.Now()
			resultCh := make(chan evalResponse)
			data := &Evaluation{
				scheduledAt: expected,
				rule:        ruleSpec,
				folderTitle: util.GenerateShortUID(),
			}
			go func() {
				result, dropped := r.Eval(data)
				resultCh <- evalResponse{result, dropped}
			}()
			select {
			case ctx := <-r.evalCh:
				require.Equal(t, data, ctx)
				result := <-resultCh
				require.True(t, result.success)
				require.Nilf(t, result.droppedEval, "expected no dropped evaluations but got one")
			case <-time.After(5 * time.Second):
				t.Fatal("No message was received on eval channel")
			}
		})
		t.Run("eval should drop any concurrent sending to evalCh", func(t *testing.T) {
			ruleSpec := gen.GenerateRef()
			r := blankRuleForTests(context.Background(), ruleSpec.GetKeyWithGroup())
			time1 := time.UnixMilli(rand.Int63n(math.MaxInt64))
			time2 := time.UnixMilli(rand.Int63n(math.MaxInt64))
			resultCh1 := make(chan evalResponse)
			resultCh2 := make(chan evalResponse)
			data := &Evaluation{
				scheduledAt: time1,
				rule:        ruleSpec,
				folderTitle: util.GenerateShortUID(),
			}
			data2 := &Evaluation{
				scheduledAt: time2,
				rule:        data.rule,
				folderTitle: data.folderTitle,
			}
			wg := sync.WaitGroup{}
			wg.Add(1)
			go func() {
				wg.Done()
				result, dropped := r.Eval(data)
				wg.Done()
				resultCh1 <- evalResponse{result, dropped}
			}()
			wg.Wait()
			wg.Add(2) // one when time1 is sent, another when go-routine for time2 has started
			go func() {
				wg.Done()
				result, dropped := r.Eval(data2)
				resultCh2 <- evalResponse{result, dropped}
			}()
			wg.Wait() // at this point tick 1 has already been dropped
			select {
			case ctx := <-r.evalCh:
				require.Equal(t, time2, ctx.scheduledAt)
				result := <-resultCh1
				require.True(t, result.success)
				require.Nilf(t, result.droppedEval, "expected no dropped evaluations but got one")
				result = <-resultCh2
				require.True(t, result.success)
				require.NotNil(t, result.droppedEval, "expected no dropped evaluations but got one")
				require.Equal(t, time1, result.droppedEval.scheduledAt)
			case <-time.After(5 * time.Second):
				t.Fatal("No message was received on eval channel")
			}
		})
		t.Run("eval should exit when context is cancelled", func(t *testing.T) {
			ruleSpec := gen.GenerateRef()
			r := blankRuleForTests(context.Background(), ruleSpec.GetKeyWithGroup())
			resultCh := make(chan evalResponse)
			data := &Evaluation{
				scheduledAt: time.Now(),
				rule:        ruleSpec,
				folderTitle: util.GenerateShortUID(),
			}
			go func() {
				result, dropped := r.Eval(data)
				resultCh <- evalResponse{result, dropped}
			}()
			runtime.Gosched()
			r.Stop(nil)
			select {
			case result := <-resultCh:
				require.False(t, result.success)
				require.Nilf(t, result.droppedEval, "expected no dropped evaluations but got one")
			case <-time.After(5 * time.Second):
				t.Fatal("No message was received on eval channel")
			}
		})
	})
	t.Run("when rule evaluation is stopped", func(t *testing.T) {
		t.Run("Update should do nothing", func(t *testing.T) {
			r := blankRuleForTests(context.Background(), models.GenerateRuleKeyWithGroup(1))
			r.Stop(errRuleDeleted)
			require.ErrorIs(t, r.ctx.Err(), errRuleDeleted)
			require.False(t, r.Update(&Evaluation{rule: gen.GenerateRef()}))
		})
		t.Run("eval should do nothing", func(t *testing.T) {
			ruleSpec := gen.GenerateRef()
			r := blankRuleForTests(context.Background(), ruleSpec.GetKeyWithGroup())
			r.Stop(nil)
			data := &Evaluation{
				scheduledAt: time.Now(),
				rule:        ruleSpec,
				folderTitle: util.GenerateShortUID(),
			}
			success, dropped := r.Eval(data)
			require.False(t, success)
			require.Nilf(t, dropped, "expected no dropped evaluations but got one")
		})
		t.Run("calling stop multiple times should not panic", func(t *testing.T) {
			r := blankRuleForTests(context.Background(), models.GenerateRuleKeyWithGroup(1))
			r.Stop(nil)
			r.Stop(nil)
		})
		t.Run("stop should not panic if parent context stopped", func(t *testing.T) {
			ctx, cancelFn := context.WithCancel(context.Background())
			r := blankRuleForTests(ctx, models.GenerateRuleKeyWithGroup(1))
			cancelFn()
			r.Stop(nil)
		})
	})
	t.Run("should be thread-safe", func(t *testing.T) {
		r := blankRuleForTests(context.Background(), models.GenerateRuleKeyWithGroup(1))
		wg := sync.WaitGroup{}
		go func() {
			for {
				select {
				case <-r.evalCh:
					time.Sleep(time.Microsecond)
				case <-r.updateCh:
					time.Sleep(time.Microsecond)
				case <-r.ctx.Done():
					return
				}
			}
		}()

		rule := gen.GenerateRef()
		rule.UID = r.key.UID
		rule.OrgID = r.key.OrgID
		for i := 0; i < 10; i++ {
			wg.Add(1)
			go func() {
				for i := 0; i < 20; i++ {
					max := 3
					if i <= 10 {
						max = 2
					}
					switch rand.Intn(max) + 1 {
					case 1:
						r.Update(&Evaluation{rule: gen.GenerateRef()})
					case 2:
						r.Eval(&Evaluation{
							scheduledAt: time.Now(),
							rule:        rule,
							folderTitle: util.GenerateShortUID(),
						})
					case 3:
						r.Stop(nil)
					}
				}
				wg.Done()
			}()
		}

		wg.Wait()
	})

	t.Run("Run should exit if idle when Stop is called", func(t *testing.T) {
		rule := blankRuleForTests(context.Background(), models.GenerateRuleKeyWithGroup(1))
		runResult := make(chan error)
		go func() {
			runResult <- rule.Run()
		}()

		rule.Stop(nil)

		select {
		case err := <-runResult:
			require.NoError(t, err)
		case <-time.After(5 * time.Second):
			t.Fatal("Run() never exited")
		}
	})
}

func TestAlertRuleIdentifier(t *testing.T) {
	t.Run("should return correct identifier", func(t *testing.T) {
		key := models.GenerateRuleKeyWithGroup(1)
		r := blankRuleForTests(context.Background(), key)
		require.Equal(t, key, r.Identifier())
	})
}

func blankRuleForTests(ctx context.Context, key models.AlertRuleKeyWithGroup) *alertRule {
	managerCfg := state.ManagerCfg{
		Historian: &state.FakeHistorian{},
		Log:       log.NewNopLogger(),
	}
	st := state.NewManager(managerCfg, state.NewNoopPersister())
	return newAlertRule(ctx, key, nil, false, 0, nil, st, nil, nil, nil, log.NewNopLogger(), nil, nil, nil)
}

func TestRuleRoutine(t *testing.T) {
	gen := models.RuleGen
	createSchedule := func(
		evalAppliedChan chan time.Time,
		senderMock *SyncAlertsSenderMock,
	) (*schedule, *fakeRulesStore, *state.FakeInstanceStore, prometheus.Gatherer) {
		ruleStore := newFakeRulesStore()
		instanceStore := &state.FakeInstanceStore{}

		registry := prometheus.NewPedanticRegistry()
		sch := setupScheduler(t, ruleStore, instanceStore, registry, senderMock, nil, nil)
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
			evalAppliedChan := make(chan time.Time)
			sch, ruleStore, instanceStore, reg := createSchedule(evalAppliedChan, nil)

			rule := gen.With(withQueryForState(t, evalState)).GenerateRef()
			ruleStore.PutRule(context.Background(), rule)
			folderTitle := ruleStore.getNamespaceTitle(rule.NamespaceUID)
			factory := ruleFactoryFromScheduler(sch)
			ctx, cancel := context.WithCancel(context.Background())
			t.Cleanup(cancel)
			ruleInfo := factory.new(ctx, rule)
			go func() {
				_ = ruleInfo.Run()
			}()

			expectedTime := time.UnixMicro(rand.Int63())

			ruleInfo.Eval(&Evaluation{
				scheduledAt: expectedTime,
				rule:        rule,
				folderTitle: folderTitle,
			})

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
				require.NotNil(t, s.LatestResult)
				var expectedStatus = evalState
				if evalState == eval.Pending {
					expectedStatus = eval.Alerting
				}
				require.Equal(t, expectedStatus.String(), s.LatestResult.EvaluationState.String())
				require.Equal(t, expectedTime, s.LatestResult.EvaluationTime)
			})
			t.Run("it should save alert instances to storage", func(t *testing.T) {
				// TODO rewrite when we are able to mock/fake state manager
				states := sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
				require.Len(t, states, 1)
				s := states[0]

				var cmd *models.AlertInstance
				for _, op := range instanceStore.RecordedOps() {
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

			t.Run("status should accurately reflect latest evaluation", func(t *testing.T) {
				states := sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
				require.NotEmpty(t, states)

				status := ruleInfo.Status()
				require.Equal(t, "ok", status.Health)
				require.Nil(t, status.LastError)
				require.Equal(t, states[0].LastEvaluationTime, status.EvaluationTimestamp)
				require.Equal(t, states[0].EvaluationDuration, status.EvaluationDuration)
			})

			t.Run("it reports metrics", func(t *testing.T) {
				// duration metric has 0 values because of mocked clock that do not advance
				expectedMetric := fmt.Sprintf(
					`# HELP grafana_alerting_rule_evaluation_duration_seconds The time to evaluate a rule.
        	            	# TYPE grafana_alerting_rule_evaluation_duration_seconds histogram
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.01"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.1"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.5"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="1"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="5"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="10"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="15"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="30"} 1
							grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="60"} 1
							grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="120"} 1
							grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="180"} 1
							grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="240"} 1
							grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="300"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="+Inf"} 1
        	            	grafana_alerting_rule_evaluation_duration_seconds_sum{org="%[1]d"} 0
        	            	grafana_alerting_rule_evaluation_duration_seconds_count{org="%[1]d"} 1
							# HELP grafana_alerting_rule_evaluation_failures_total The total number of rule evaluation failures.
        	            	# TYPE grafana_alerting_rule_evaluation_failures_total counter
        	            	grafana_alerting_rule_evaluation_failures_total{org="%[1]d"} 0
        	            	# HELP grafana_alerting_rule_evaluations_total The total number of rule evaluations.
        	            	# TYPE grafana_alerting_rule_evaluations_total counter
        	            	grafana_alerting_rule_evaluations_total{org="%[1]d"} 1
        	            	# HELP grafana_alerting_rule_evaluation_attempt_failures_total The total number of rule evaluation attempt failures.
        	            	# TYPE grafana_alerting_rule_evaluation_attempt_failures_total counter
        	            	grafana_alerting_rule_evaluation_attempt_failures_total{org="%[1]d"} 0
        	            	# HELP grafana_alerting_rule_evaluation_attempts_total The total number of rule evaluation attempts.
        	            	# TYPE grafana_alerting_rule_evaluation_attempts_total counter
        	            	grafana_alerting_rule_evaluation_attempts_total{org="%[1]d"} 1

							# HELP grafana_alerting_rule_process_evaluation_duration_seconds The time to process the evaluation results for a rule.
							# TYPE grafana_alerting_rule_process_evaluation_duration_seconds histogram
							grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="0.01"} 1
							grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="0.1"} 1
							grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="0.5"} 1
							grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="1"} 1
							grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="5"} 1
							grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="10"} 1
							grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="15"} 1
							grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="30"} 1
							grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="60"} 1
							grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="120"} 1
							grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="180"} 1
							grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="240"} 1
							grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="300"} 1
							grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="+Inf"} 1
							grafana_alerting_rule_process_evaluation_duration_seconds_sum{org="%[1]d"} 0
							grafana_alerting_rule_process_evaluation_duration_seconds_count{org="%[1]d"} 1
							# HELP grafana_alerting_rule_send_alerts_duration_seconds The time to send the alerts to Alertmanager.
							# TYPE grafana_alerting_rule_send_alerts_duration_seconds histogram
							grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="0.01"} 1
							grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="0.1"} 1
							grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="0.5"} 1
							grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="1"} 1
							grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="5"} 1
							grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="10"} 1
							grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="15"} 1
							grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="30"} 1
							grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="60"} 1
							grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="120"} 1
							grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="180"} 1
							grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="240"} 1
							grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="300"} 1
							grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="+Inf"} 1
							grafana_alerting_rule_send_alerts_duration_seconds_sum{org="%[1]d"} 0
							grafana_alerting_rule_send_alerts_duration_seconds_count{org="%[1]d"} 1
				`, rule.OrgID)

				err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric),
					"grafana_alerting_rule_evaluation_duration_seconds",
					"grafana_alerting_rule_evaluations_total",
					"grafana_alerting_rule_evaluation_failures_total",
					"grafana_alerting_rule_evaluation_attempts_total",
					"grafana_alerting_rule_evaluation_attempt_failures_total",
					"grafana_alerting_rule_process_evaluation_duration_seconds",
					"grafana_alerting_rule_send_alerts_duration_seconds")
				require.NoError(t, err)
			})
		})
	}

	t.Run("should exit", func(t *testing.T) {
		rule := gen.With(withQueryForState(t, eval.Alerting)).GenerateRef()
		genEvalResults := func(now time.Time) eval.Results {
			return eval.GenerateResults(
				rand.Intn(5)+1,
				eval.ResultGen(
					eval.WithEvaluatedAt(now),
					// State should be alerting to test resolved notifications in some cases.
					// When the alert rule is firing and is deleted, we should send
					// resolved notifications.
					eval.WithState(eval.Alerting),
				),
			)
		}

		t.Run("and clean up the state if parent context is cancelled", func(t *testing.T) {
			stoppedChan := make(chan error)
			sender := NewSyncAlertsSenderMock()
			sch, _, _, _ := createSchedule(make(chan time.Time), sender)

			_ = sch.stateManager.ProcessEvalResults(context.Background(), sch.clock.Now(), rule, genEvalResults(sch.clock.Now()), nil, nil)
			expectedStates := sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
			require.NotEmpty(t, expectedStates)

			factory := ruleFactoryFromScheduler(sch)
			ctx, cancel := context.WithCancel(context.Background())
			ruleInfo := factory.new(ctx, rule)
			go func() {
				err := ruleInfo.Run()
				stoppedChan <- err
			}()

			cancel()
			err := waitForErrChannel(t, stoppedChan)
			require.NoError(t, err)
			require.Empty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))
			sender.AlertsSenderMock.AssertNotCalled(t, "Send")
		})

		t.Run("and clean up the state but not send anything if the reason is not rule deleted", func(t *testing.T) {
			stoppedChan := make(chan error)
			sender := NewSyncAlertsSenderMock()
			sch, _, _, _ := createSchedule(make(chan time.Time), sender)

			_ = sch.stateManager.ProcessEvalResults(context.Background(), sch.clock.Now(), rule, genEvalResults(sch.clock.Now()), nil, nil)
			require.NotEmpty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))

			factory := ruleFactoryFromScheduler(sch)
			ruleInfo := factory.new(context.Background(), rule)
			go func() {
				err := ruleInfo.Run()
				stoppedChan <- err
			}()

			ruleInfo.Stop(errors.New("some reason"))
			err := waitForErrChannel(t, stoppedChan)
			require.NoError(t, err)

			require.Empty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))
			sender.AlertsSenderMock.AssertNotCalled(t, "Send")
		})

		t.Run("and send resolved notifications if errRuleDeleted is the reason for stopping", func(t *testing.T) {
			stoppedChan := make(chan error)
			sender := NewSyncAlertsSenderMock()
			sender.EXPECT().Send(mock.Anything, mock.Anything, mock.Anything).Times(1)
			sch, _, _, _ := createSchedule(make(chan time.Time), sender)

			_ = sch.stateManager.ProcessEvalResults(context.Background(), sch.clock.Now(), rule, genEvalResults(sch.clock.Now()), nil, nil)
			require.NotEmpty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))

			factory := ruleFactoryFromScheduler(sch)
			ruleInfo := factory.new(context.Background(), rule)
			go func() {
				err := ruleInfo.Run()
				stoppedChan <- err
			}()

			ruleInfo.Stop(errRuleDeleted)
			err := waitForErrChannel(t, stoppedChan)
			require.NoError(t, err)

			require.Empty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))
			sender.AlertsSenderMock.AssertExpectations(t)
		})
	})

	t.Run("when a message is sent to update channel", func(t *testing.T) {
		rule := gen.With(withQueryForState(t, eval.Normal)).GenerateRef()
		folderTitle := "folderName"

		evalAppliedChan := make(chan time.Time)

		sender := NewSyncAlertsSenderMock()
		sender.EXPECT().Send(mock.Anything, rule.GetKey(), mock.Anything).Return()

		sch, ruleStore, _, _ := createSchedule(evalAppliedChan, sender)
		ruleStore.PutRule(context.Background(), rule)
		sch.schedulableAlertRules.set([]*models.AlertRule{rule}, map[models.FolderKey]string{rule.GetFolderKey(): folderTitle})
		factory := ruleFactoryFromScheduler(sch)
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)
		ruleInfo := factory.new(ctx, rule)

		go func() {
			_ = ruleInfo.Run()
		}()

		// init evaluation loop so it got the rule version
		ruleInfo.Eval(&Evaluation{
			scheduledAt: sch.clock.Now(),
			rule:        rule,
			folderTitle: folderTitle,
		})

		waitForTimeChannel(t, evalAppliedChan)

		// define some state
		states := make([]*state.State, 0, len(allStates))
		for _, s := range allStates {
			for i := 0; i < 2; i++ {
				states = append(states, &state.State{
					AlertRuleUID: rule.UID,
					CacheID:      data.Labels(rule.Labels).Fingerprint(),
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
			ruleInfo.Update(&Evaluation{rule: rule, folderTitle: folderTitle})
			ruleInfo.Update(&Evaluation{rule: rule, folderTitle: folderTitle}) // second time just to make sure that previous messages were handled

			actualStates := sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
			require.Len(t, actualStates, len(states))

			sender.AssertNotCalled(t, "Send", mock.Anything, mock.Anything)
		})

		t.Run("should clear the state and expire firing alerts if version in channel is greater", func(t *testing.T) {
			ruleInfo.Update(&Evaluation{rule: models.CopyRule(rule, gen.WithTitle(util.GenerateShortUID())), folderTitle: folderTitle})

			require.Eventually(t, func() bool {
				return len(sender.Calls()) > 0
			}, 5*time.Second, 100*time.Millisecond)

			require.Empty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))
			sender.AssertNumberOfCalls(t, "Send", 1)
			args, ok := sender.Calls()[0].Arguments[2].(definitions.PostableAlerts)
			require.Truef(t, ok, fmt.Sprintf("expected argument of function was supposed to be 'definitions.PostableAlerts' but got %T", sender.Calls()[0].Arguments[2]))
			require.Len(t, args.PostableAlerts, expectedToBeSent)
		})
	})

	t.Run("when evaluation fails", func(t *testing.T) {
		rule := gen.With(withQueryForState(t, eval.Error)).GenerateRef()
		rule.ExecErrState = models.ErrorErrState

		evalAppliedChan := make(chan time.Time)

		sender := NewSyncAlertsSenderMock()
		sender.EXPECT().Send(mock.Anything, rule.GetKey(), mock.Anything).Return()

		sch, ruleStore, _, reg := createSchedule(evalAppliedChan, sender)
		sch.maxAttempts = 3
		ruleStore.PutRule(context.Background(), rule)
		factory := ruleFactoryFromScheduler(sch)
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)
		ruleInfo := factory.new(ctx, rule)

		go func() {
			_ = ruleInfo.Run()
		}()

		ruleInfo.Eval(&Evaluation{
			scheduledAt: sch.clock.Now(),
			rule:        rule,
		})

		waitForTimeChannel(t, evalAppliedChan)

		t.Run("it should increase failure counter by 1 and attempt failure counter by 3", func(t *testing.T) {
			// duration metric has 0 values because of mocked clock that do not advance
			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_rule_evaluation_duration_seconds The time to evaluate a rule.
        	            # TYPE grafana_alerting_rule_evaluation_duration_seconds histogram
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.01"} 1
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.1"} 1
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.5"} 1
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="1"} 1
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="5"} 1
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="10"} 1
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="15"} 1
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="30"} 1
						grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="60"} 1
						grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="120"} 1
						grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="180"} 1
						grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="240"} 1
						grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="300"} 1
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="+Inf"} 1
        	            grafana_alerting_rule_evaluation_duration_seconds_sum{org="%[1]d"} 0
        	            grafana_alerting_rule_evaluation_duration_seconds_count{org="%[1]d"} 1
						# HELP grafana_alerting_rule_evaluation_failures_total The total number of rule evaluation failures.
        	            # TYPE grafana_alerting_rule_evaluation_failures_total counter
        	            grafana_alerting_rule_evaluation_failures_total{org="%[1]d"} 1
        	            # HELP grafana_alerting_rule_evaluations_total The total number of rule evaluations.
        	            # TYPE grafana_alerting_rule_evaluations_total counter
        	            grafana_alerting_rule_evaluations_total{org="%[1]d"} 1
        	            # HELP grafana_alerting_rule_evaluation_attempt_failures_total The total number of rule evaluation attempt failures.
        	            # TYPE grafana_alerting_rule_evaluation_attempt_failures_total counter
        	            grafana_alerting_rule_evaluation_attempt_failures_total{org="%[1]d"} 3
        	            # HELP grafana_alerting_rule_evaluation_attempts_total The total number of rule evaluation attempts.
        	            # TYPE grafana_alerting_rule_evaluation_attempts_total counter
        	            grafana_alerting_rule_evaluation_attempts_total{org="%[1]d"} 3
						# HELP grafana_alerting_rule_process_evaluation_duration_seconds The time to process the evaluation results for a rule.
						# TYPE grafana_alerting_rule_process_evaluation_duration_seconds histogram
						grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="0.01"} 1
						grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="0.1"} 1
						grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="0.5"} 1
						grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="1"} 1
						grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="5"} 1
						grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="10"} 1
						grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="15"} 1
						grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="30"} 1
						grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="60"} 1
						grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="120"} 1
						grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="180"} 1
						grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="240"} 1
						grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="300"} 1
						grafana_alerting_rule_process_evaluation_duration_seconds_bucket{org="%[1]d",le="+Inf"} 1
						grafana_alerting_rule_process_evaluation_duration_seconds_sum{org="%[1]d"} 0
						grafana_alerting_rule_process_evaluation_duration_seconds_count{org="%[1]d"} 1
						# HELP grafana_alerting_rule_send_alerts_duration_seconds The time to send the alerts to Alertmanager.
						# TYPE grafana_alerting_rule_send_alerts_duration_seconds histogram
						grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="0.01"} 1
						grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="0.1"} 1
						grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="0.5"} 1
						grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="1"} 1
						grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="5"} 1
						grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="10"} 1
						grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="15"} 1
						grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="30"} 1
						grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="60"} 1
						grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="120"} 1
						grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="180"} 1
						grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="240"} 1
						grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="300"} 1
						grafana_alerting_rule_send_alerts_duration_seconds_bucket{org="%[1]d",le="+Inf"} 1
						grafana_alerting_rule_send_alerts_duration_seconds_sum{org="%[1]d"} 0
						grafana_alerting_rule_send_alerts_duration_seconds_count{org="%[1]d"} 1
				`, rule.OrgID)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric),
				"grafana_alerting_rule_evaluation_duration_seconds",
				"grafana_alerting_rule_evaluations_total",
				"grafana_alerting_rule_evaluation_failures_total",
				"grafana_alerting_rule_evaluation_attempts_total",
				"grafana_alerting_rule_evaluation_attempt_failures_total",
				"grafana_alerting_rule_process_evaluation_duration_seconds",
				"grafana_alerting_rule_send_alerts_duration_seconds")
			require.NoError(t, err)
		})

		t.Run("it should send special alert DatasourceError", func(t *testing.T) {
			sender.AssertNumberOfCalls(t, "Send", 1)
			args, ok := sender.Calls()[0].Arguments[2].(definitions.PostableAlerts)
			require.Truef(t, ok, fmt.Sprintf("expected argument of function was supposed to be 'definitions.PostableAlerts' but got %T", sender.Calls()[0].Arguments[2]))
			assert.Len(t, args.PostableAlerts, 1)
			assert.Equal(t, state.ErrorAlertName, args.PostableAlerts[0].Labels[prometheusModel.AlertNameLabel])
		})

		t.Run("status should reflect unhealthy rule", func(t *testing.T) {
			status := ruleInfo.Status()
			require.Equal(t, "error", status.Health)
			require.NotNil(t, status.LastError, "expected status to carry the latest evaluation error")
			require.Contains(t, status.LastError.Error(), "cannot reference itself")
			require.Equal(t, int64(0), status.EvaluationTimestamp.UTC().Unix())
			require.Equal(t, time.Duration(0), status.EvaluationDuration)
		})
	})

	t.Run("when there are alerts that should be firing", func(t *testing.T) {
		t.Run("it should call sender", func(t *testing.T) {
			// eval.Alerting makes state manager to create notifications for alertmanagers
			rule := gen.With(withQueryForState(t, eval.Alerting)).GenerateRef()

			evalAppliedChan := make(chan time.Time)

			sender := NewSyncAlertsSenderMock()
			sender.EXPECT().Send(mock.Anything, rule.GetKey(), mock.Anything).Return()

			sch, ruleStore, _, _ := createSchedule(evalAppliedChan, sender)
			ruleStore.PutRule(context.Background(), rule)
			factory := ruleFactoryFromScheduler(sch)
			ctx, cancel := context.WithCancel(context.Background())
			t.Cleanup(cancel)
			ruleInfo := factory.new(ctx, rule)

			go func() {
				_ = ruleInfo.Run()
			}()

			ruleInfo.Eval(&Evaluation{
				scheduledAt: sch.clock.Now(),
				rule:        rule,
			})

			waitForTimeChannel(t, evalAppliedChan)

			sender.AssertNumberOfCalls(t, "Send", 1)
			args, ok := sender.Calls()[0].Arguments[2].(definitions.PostableAlerts)
			require.Truef(t, ok, fmt.Sprintf("expected argument of function was supposed to be 'definitions.PostableAlerts' but got %T", sender.Calls()[0].Arguments[2]))

			require.Len(t, args.PostableAlerts, 1)
		})
	})

	t.Run("when there are no alerts to send it should not call notifiers", func(t *testing.T) {
		rule := gen.With(withQueryForState(t, eval.Normal)).GenerateRef()

		evalAppliedChan := make(chan time.Time)

		sender := NewSyncAlertsSenderMock()
		sender.EXPECT().Send(mock.Anything, rule.GetKey(), mock.Anything).Return()

		sch, ruleStore, _, _ := createSchedule(evalAppliedChan, sender)
		ruleStore.PutRule(context.Background(), rule)
		factory := ruleFactoryFromScheduler(sch)
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)
		ruleInfo := factory.new(ctx, rule)

		go func() {
			_ = ruleInfo.Run()
		}()

		ruleInfo.Eval(&Evaluation{
			scheduledAt: sch.clock.Now(),
			rule:        rule,
		})

		waitForTimeChannel(t, evalAppliedChan)

		sender.AssertNotCalled(t, "Send", mock.Anything, mock.Anything)

		require.NotEmpty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))
	})

	t.Run("when there are resolved alerts they should keep sending until retention period is over", func(t *testing.T) {
		rule := gen.With(withQueryForState(t, eval.Normal), models.RuleMuts.WithInterval(time.Second)).GenerateRef()

		evalAppliedChan := make(chan time.Time)

		sender := NewSyncAlertsSenderMock()
		sender.EXPECT().Send(mock.Anything, rule.GetKey(), mock.Anything).Return()

		sch, ruleStore, _, _ := createSchedule(evalAppliedChan, sender)
		sch.stateManager.ResolvedRetention = 4 * time.Second
		sch.stateManager.ResendDelay = 2 * time.Second
		sch.stateManager.Put([]*state.State{
			stateForRule(rule, sch.clock.Now(), eval.Alerting), // Add existing Alerting state so evals will resolve.
		})

		ruleStore.PutRule(context.Background(), rule)
		factory := ruleFactoryFromScheduler(sch)
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)
		ruleInfo := factory.new(ctx, rule)

		go func() {
			_ = ruleInfo.Run()
		}()

		// Evaluate 10 times:
		// 1. Send resolve #1.
		// 2. 2s resend delay.
		// 3. Send resolve #2.
		// 4. 2s resend delay.
		// 5. Send resolve #3.
		// 6. No more sends, 4s retention period is over.
		expectedResolves := map[time.Time]struct{}{
			sch.clock.Now().Add(1 * time.Second): {},
			sch.clock.Now().Add(3 * time.Second): {},
			sch.clock.Now().Add(5 * time.Second): {},
		}
		calls := 0
		for i := 1; i < 10; i++ {
			ts := sch.clock.Now().Add(time.Duration(int64(i)*rule.IntervalSeconds) * time.Second)
			ruleInfo.Eval(&Evaluation{
				scheduledAt: ts,
				rule:        rule,
			})
			waitForTimeChannel(t, evalAppliedChan)

			if _, ok := expectedResolves[ts]; ok {
				calls++
				prevCallAlerts, ok := sender.Calls()[calls-1].Arguments[2].(definitions.PostableAlerts)
				assert.Truef(t, ok, fmt.Sprintf("expected argument of function was supposed to be 'definitions.PostableAlerts' but got %T", sender.Calls()[calls-1].Arguments[2]))
				assert.Len(t, prevCallAlerts.PostableAlerts, 1)
			}
			sender.AssertNumberOfCalls(t, "Send", calls)
		}
	})
}

func ruleFactoryFromScheduler(sch *schedule) ruleFactory {
	return newRuleFactory(sch.appURL, sch.disableGrafanaFolder, sch.maxAttempts, sch.alertsSender, sch.stateManager, sch.evaluatorFactory, sch.clock, sch.rrCfg, sch.metrics, sch.log, sch.tracer, sch.recordingWriter, sch.evalAppliedFunc, sch.stopAppliedFunc)
}

func stateForRule(rule *models.AlertRule, ts time.Time, evalState eval.State) *state.State {
	s := &state.State{
		OrgID:              rule.OrgID,
		AlertRuleUID:       rule.UID,
		CacheID:            0,
		State:              evalState,
		Annotations:        make(map[string]string),
		Labels:             make(map[string]string),
		StartsAt:           ts,
		EndsAt:             ts,
		ResolvedAt:         &ts,
		LastSentAt:         &ts,
		LastEvaluationTime: ts,
	}
	for k, v := range rule.Labels {
		s.Labels[k] = v
	}
	for k, v := range state.GetRuleExtraLabels(&logtest.Fake{}, rule, "", true) {
		if _, ok := s.Labels[k]; !ok {
			s.Labels[k] = v
		}
	}
	il := models.InstanceLabels(s.Labels)
	s.Labels = data.Labels(il)
	id := il.Fingerprint()
	s.CacheID = id

	return s
}
