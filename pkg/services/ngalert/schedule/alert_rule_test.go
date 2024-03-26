package schedule

import (
	"bytes"
	context "context"
	"fmt"
	"math"
	"math/rand"
	"runtime"
	"sync"
	"testing"
	"time"

	alertingModels "github.com/grafana/alerting/models"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	definitions "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/util"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	prometheusModel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestAlertRule(t *testing.T) {
	type evalResponse struct {
		success     bool
		droppedEval *Evaluation
	}

	t.Run("when rule evaluation is not stopped", func(t *testing.T) {
		t.Run("update should send to updateCh", func(t *testing.T) {
			r := blankRuleForTests(context.Background())
			resultCh := make(chan bool)
			go func() {
				resultCh <- r.Update(RuleVersionAndPauseStatus{fingerprint(rand.Uint64()), false})
			}()
			select {
			case <-r.updateCh:
				require.True(t, <-resultCh)
			case <-time.After(5 * time.Second):
				t.Fatal("No message was received on update channel")
			}
		})
		t.Run("update should drop any concurrent sending to updateCh", func(t *testing.T) {
			r := blankRuleForTests(context.Background())
			version1 := RuleVersionAndPauseStatus{fingerprint(rand.Uint64()), false}
			version2 := RuleVersionAndPauseStatus{fingerprint(rand.Uint64()), false}

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
			r := blankRuleForTests(context.Background())
			expected := time.Now()
			resultCh := make(chan evalResponse)
			data := &Evaluation{
				scheduledAt: expected,
				rule:        models.AlertRuleGen()(),
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
			r := blankRuleForTests(context.Background())
			time1 := time.UnixMilli(rand.Int63n(math.MaxInt64))
			time2 := time.UnixMilli(rand.Int63n(math.MaxInt64))
			resultCh1 := make(chan evalResponse)
			resultCh2 := make(chan evalResponse)
			data := &Evaluation{
				scheduledAt: time1,
				rule:        models.AlertRuleGen()(),
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
			r := blankRuleForTests(context.Background())
			resultCh := make(chan evalResponse)
			data := &Evaluation{
				scheduledAt: time.Now(),
				rule:        models.AlertRuleGen()(),
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
			r := blankRuleForTests(context.Background())
			r.Stop(errRuleDeleted)
			require.ErrorIs(t, r.ctx.Err(), errRuleDeleted)
			require.False(t, r.Update(RuleVersionAndPauseStatus{fingerprint(rand.Uint64()), false}))
		})
		t.Run("eval should do nothing", func(t *testing.T) {
			r := blankRuleForTests(context.Background())
			r.Stop(nil)
			data := &Evaluation{
				scheduledAt: time.Now(),
				rule:        models.AlertRuleGen()(),
				folderTitle: util.GenerateShortUID(),
			}
			success, dropped := r.Eval(data)
			require.False(t, success)
			require.Nilf(t, dropped, "expected no dropped evaluations but got one")
		})
		t.Run("stop should do nothing", func(t *testing.T) {
			r := blankRuleForTests(context.Background())
			r.Stop(nil)
			r.Stop(nil)
		})
		t.Run("stop should do nothing if parent context stopped", func(t *testing.T) {
			ctx, cancelFn := context.WithCancel(context.Background())
			r := blankRuleForTests(ctx)
			cancelFn()
			r.Stop(nil)
		})
	})
	t.Run("should be thread-safe", func(t *testing.T) {
		r := blankRuleForTests(context.Background())
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
						r.Update(RuleVersionAndPauseStatus{fingerprint(rand.Uint64()), false})
					case 2:
						r.Eval(&Evaluation{
							scheduledAt: time.Now(),
							rule:        models.AlertRuleGen()(),
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
}

func blankRuleForTests(ctx context.Context) *alertRule {
	return newAlertRule(context.Background(), nil, false, 0, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)
}

func TestRuleRoutine(t *testing.T) {
	createSchedule := func(
		evalAppliedChan chan time.Time,
		senderMock *SyncAlertsSenderMock,
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
			evalAppliedChan := make(chan time.Time)
			sch, ruleStore, instanceStore, reg := createSchedule(evalAppliedChan, nil)

			rule := models.AlertRuleGen(withQueryForState(t, evalState))()
			ruleStore.PutRule(context.Background(), rule)
			folderTitle := ruleStore.getNamespaceTitle(rule.NamespaceUID)
			factory := ruleFactoryFromScheduler(sch)
			ctx, cancel := context.WithCancel(context.Background())
			t.Cleanup(cancel)
			ruleInfo := factory.new(ctx)
			go func() {
				_ = ruleInfo.Run(rule.GetKey())
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

				err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_evaluation_duration_seconds", "grafana_alerting_rule_evaluations_total", "grafana_alerting_rule_evaluation_failures_total", "grafana_alerting_rule_process_evaluation_duration_seconds", "grafana_alerting_rule_send_alerts_duration_seconds")
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

			factory := ruleFactoryFromScheduler(sch)
			ctx, cancel := context.WithCancel(context.Background())
			ruleInfo := factory.new(ctx)
			go func() {
				err := ruleInfo.Run(models.AlertRuleKey{})
				stoppedChan <- err
			}()

			cancel()
			err := waitForErrChannel(t, stoppedChan)
			require.NoError(t, err)
			require.Equal(t, len(expectedStates), len(sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)))
		})
		t.Run("and clean up the state if delete is cancellation reason for inner context", func(t *testing.T) {
			stoppedChan := make(chan error)
			sch, _, _, _ := createSchedule(make(chan time.Time), nil)

			rule := models.AlertRuleGen()()
			_ = sch.stateManager.ProcessEvalResults(context.Background(), sch.clock.Now(), rule, eval.GenerateResults(rand.Intn(5)+1, eval.ResultGen(eval.WithEvaluatedAt(sch.clock.Now()))), nil)
			require.NotEmpty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))

			factory := ruleFactoryFromScheduler(sch)
			ruleInfo := factory.new(context.Background())
			go func() {
				err := ruleInfo.Run(rule.GetKey())
				stoppedChan <- err
			}()

			ruleInfo.Stop(errRuleDeleted)
			err := waitForErrChannel(t, stoppedChan)
			require.NoError(t, err)

			require.Empty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))
		})
	})

	t.Run("when a message is sent to update channel", func(t *testing.T) {
		rule := models.AlertRuleGen(withQueryForState(t, eval.Normal))()
		folderTitle := "folderName"
		ruleFp := ruleWithFolder{rule, folderTitle}.Fingerprint()

		evalAppliedChan := make(chan time.Time)

		sender := NewSyncAlertsSenderMock()
		sender.EXPECT().Send(mock.Anything, rule.GetKey(), mock.Anything).Return()

		sch, ruleStore, _, _ := createSchedule(evalAppliedChan, sender)
		ruleStore.PutRule(context.Background(), rule)
		sch.schedulableAlertRules.set([]*models.AlertRule{rule}, map[models.FolderKey]string{rule.GetFolderKey(): folderTitle})
		factory := ruleFactoryFromScheduler(sch)
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)
		ruleInfo := factory.new(ctx)

		go func() {
			_ = ruleInfo.Run(rule.GetKey())
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
			ruleInfo.Update(RuleVersionAndPauseStatus{ruleFp, false})
			ruleInfo.Update(RuleVersionAndPauseStatus{ruleFp, false}) // second time just to make sure that previous messages were handled

			actualStates := sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
			require.Len(t, actualStates, len(states))

			sender.AssertNotCalled(t, "Send", mock.Anything, mock.Anything)
		})

		t.Run("should clear the state and expire firing alerts if version in channel is greater", func(t *testing.T) {
			ruleInfo.Update(RuleVersionAndPauseStatus{ruleFp + 1, false})

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
		rule := models.AlertRuleGen(withQueryForState(t, eval.Error))()
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
		ruleInfo := factory.new(ctx)

		go func() {
			_ = ruleInfo.Run(rule.GetKey())
		}()

		ruleInfo.Eval(&Evaluation{
			scheduledAt: sch.clock.Now(),
			rule:        rule,
		})

		waitForTimeChannel(t, evalAppliedChan)

		t.Run("it should increase failure counter", func(t *testing.T) {
			// duration metric has 0 values because of mocked clock that do not advance
			expectedMetric := fmt.Sprintf(
				`# HELP grafana_alerting_rule_evaluation_duration_seconds The time to evaluate a rule.
        	            # TYPE grafana_alerting_rule_evaluation_duration_seconds histogram
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.01"} 3
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.1"} 3
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.5"} 3
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="1"} 3
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="5"} 3
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="10"} 3
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="15"} 3
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="30"} 3
						grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="60"} 3
						grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="120"} 3
						grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="180"} 3
						grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="240"} 3
						grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="300"} 3
        	            grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="+Inf"} 3
        	            grafana_alerting_rule_evaluation_duration_seconds_sum{org="%[1]d"} 0
        	            grafana_alerting_rule_evaluation_duration_seconds_count{org="%[1]d"} 3
						# HELP grafana_alerting_rule_evaluation_failures_total The total number of rule evaluation failures.
        	            # TYPE grafana_alerting_rule_evaluation_failures_total counter
        	            grafana_alerting_rule_evaluation_failures_total{org="%[1]d"} 3
        	            # HELP grafana_alerting_rule_evaluations_total The total number of rule evaluations.
        	            # TYPE grafana_alerting_rule_evaluations_total counter
        	            grafana_alerting_rule_evaluations_total{org="%[1]d"} 3
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

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_rule_evaluation_duration_seconds", "grafana_alerting_rule_evaluations_total", "grafana_alerting_rule_evaluation_failures_total", "grafana_alerting_rule_process_evaluation_duration_seconds", "grafana_alerting_rule_send_alerts_duration_seconds")
			require.NoError(t, err)
		})

		t.Run("it should send special alert DatasourceError", func(t *testing.T) {
			sender.AssertNumberOfCalls(t, "Send", 1)
			args, ok := sender.Calls()[0].Arguments[2].(definitions.PostableAlerts)
			require.Truef(t, ok, fmt.Sprintf("expected argument of function was supposed to be 'definitions.PostableAlerts' but got %T", sender.Calls()[0].Arguments[2]))
			assert.Len(t, args.PostableAlerts, 1)
			assert.Equal(t, state.ErrorAlertName, args.PostableAlerts[0].Labels[prometheusModel.AlertNameLabel])
		})
	})

	t.Run("when there are alerts that should be firing", func(t *testing.T) {
		t.Run("it should call sender", func(t *testing.T) {
			// eval.Alerting makes state manager to create notifications for alertmanagers
			rule := models.AlertRuleGen(withQueryForState(t, eval.Alerting))()

			evalAppliedChan := make(chan time.Time)

			sender := NewSyncAlertsSenderMock()
			sender.EXPECT().Send(mock.Anything, rule.GetKey(), mock.Anything).Return()

			sch, ruleStore, _, _ := createSchedule(evalAppliedChan, sender)
			ruleStore.PutRule(context.Background(), rule)
			factory := ruleFactoryFromScheduler(sch)
			ctx, cancel := context.WithCancel(context.Background())
			t.Cleanup(cancel)
			ruleInfo := factory.new(ctx)

			go func() {
				_ = ruleInfo.Run(rule.GetKey())
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
		rule := models.AlertRuleGen(withQueryForState(t, eval.Normal))()

		evalAppliedChan := make(chan time.Time)

		sender := NewSyncAlertsSenderMock()
		sender.EXPECT().Send(mock.Anything, rule.GetKey(), mock.Anything).Return()

		sch, ruleStore, _, _ := createSchedule(evalAppliedChan, sender)
		ruleStore.PutRule(context.Background(), rule)
		factory := ruleFactoryFromScheduler(sch)
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)
		ruleInfo := factory.new(ctx)

		go func() {
			_ = ruleInfo.Run(rule.GetKey())
		}()

		ruleInfo.Eval(&Evaluation{
			scheduledAt: sch.clock.Now(),
			rule:        rule,
		})

		waitForTimeChannel(t, evalAppliedChan)

		sender.AssertNotCalled(t, "Send", mock.Anything, mock.Anything)

		require.NotEmpty(t, sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID))
	})
}

func ruleFactoryFromScheduler(sch *schedule) ruleFactory {
	return newRuleFactory(sch.appURL, sch.disableGrafanaFolder, sch.maxAttempts, sch.alertsSender, sch.stateManager, sch.evaluatorFactory, &sch.schedulableAlertRules, sch.clock, sch.metrics, sch.log, sch.tracer, sch.evalAppliedFunc, sch.stopAppliedFunc)
}
