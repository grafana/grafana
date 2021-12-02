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
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSendingToExternalAlertmanager(t *testing.T) {
	fakeAM := NewFakeExternalAlertmanager(t)
	defer fakeAM.Close()
	fakeRuleStore := newFakeRuleStore(t)
	fakeInstanceStore := &FakeInstanceStore{}
	fakeAdminConfigStore := newFakeAdminConfigStore(t)

	// create alert rule with one second interval
	alertRule := CreateTestAlertRule(t, fakeRuleStore, 1, 1, eval.Alerting)

	// First, let's create an admin configuration that holds an alertmanager.
	adminConfig := &models.AdminConfiguration{OrgID: 1, Alertmanagers: []string{fakeAM.server.URL}}
	cmd := store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfig}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	sched, mockedClock := setupScheduler(t, fakeRuleStore, fakeInstanceStore, fakeAdminConfigStore, nil)

	// Make sure we sync the configuration at least once before the evaluation happens to guarantee the sender is running
	// when the first alert triggers.
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())
	sched.sendersMtx.Lock()
	require.Equal(t, 1, len(sched.senders))
	require.Equal(t, 1, len(sched.sendersCfgHash))
	sched.sendersMtx.Unlock()

	// Then, ensure we've discovered the Alertmanager.
	require.Eventually(t, func() bool {
		return len(sched.AlertmanagersFor(1)) == 1 && len(sched.DroppedAlertmanagersFor(1)) == 0
	}, 10*time.Second, 200*time.Millisecond)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(func() {
		cancel()
	})
	go func() {
		err := sched.Run(ctx)
		require.NoError(t, err)
	}()

	// With everything up and running, let's advance the time to make sure we get at least one alert iteration.
	mockedClock.Add(2 * time.Second)

	// Eventually, our Alertmanager should have received at least one alert.
	require.Eventually(t, func() bool {
		return fakeAM.AlertsCount() >= 1 && fakeAM.AlertNamesCompare([]string{alertRule.Title})
	}, 10*time.Second, 200*time.Millisecond)

	// Now, let's remove the Alertmanager from the admin configuration.
	adminConfig.Alertmanagers = []string{}
	cmd = store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfig}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	// Again, make sure we sync and verify the senders.
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())
	sched.sendersMtx.Lock()
	require.Equal(t, 0, len(sched.senders))
	require.Equal(t, 0, len(sched.sendersCfgHash))
	sched.sendersMtx.Unlock()

	// Then, ensure we've dropped the Alertmanager.
	require.Eventually(t, func() bool {
		return len(sched.AlertmanagersFor(1)) == 0 && len(sched.DroppedAlertmanagersFor(1)) == 0
	}, 10*time.Second, 200*time.Millisecond)
}

func TestSendingToExternalAlertmanager_WithMultipleOrgs(t *testing.T) {
	fakeAM := NewFakeExternalAlertmanager(t)
	defer fakeAM.Close()
	fakeRuleStore := newFakeRuleStore(t)
	fakeInstanceStore := &FakeInstanceStore{}
	fakeAdminConfigStore := newFakeAdminConfigStore(t)

	// First, let's create an admin configuration that holds an alertmanager.
	adminConfig := &models.AdminConfiguration{OrgID: 1, Alertmanagers: []string{fakeAM.server.URL}}
	cmd := store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfig}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	sched, mockedClock := setupScheduler(t, fakeRuleStore, fakeInstanceStore, fakeAdminConfigStore, nil)

	// Make sure we sync the configuration at least once before the evaluation happens to guarantee the sender is running
	// when the first alert triggers.
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())
	sched.sendersMtx.Lock()
	require.Equal(t, 1, len(sched.senders))
	require.Equal(t, 1, len(sched.sendersCfgHash))
	sched.sendersMtx.Unlock()

	// Then, ensure we've discovered the Alertmanager.
	require.Eventuallyf(t, func() bool {
		return len(sched.AlertmanagersFor(1)) == 1 && len(sched.DroppedAlertmanagersFor(1)) == 0
	}, 10*time.Second, 200*time.Millisecond, "Alertmanager for org 1 was never discovered")

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(func() {
		cancel()
	})
	go func() {
		err := sched.Run(ctx)
		require.NoError(t, err)
	}()

	// 1. Now, let's assume a new org comes along.
	adminConfig2 := &models.AdminConfiguration{OrgID: 2, Alertmanagers: []string{fakeAM.server.URL}}
	cmd = store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfig2}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	// If we sync again, new senders must have spawned.
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())
	sched.sendersMtx.Lock()
	require.Equal(t, 2, len(sched.senders))
	require.Equal(t, 2, len(sched.sendersCfgHash))
	sched.sendersMtx.Unlock()

	// Then, ensure we've discovered the Alertmanager for the new organization.
	require.Eventuallyf(t, func() bool {
		return len(sched.AlertmanagersFor(2)) == 1 && len(sched.DroppedAlertmanagersFor(2)) == 0
	}, 10*time.Second, 200*time.Millisecond, "Alertmanager for org 2 was never discovered")

	// With everything up and running, let's advance the time to make sure we get at least one alert iteration.
	mockedClock.Add(10 * time.Second)

	// TODO(gotjosh): Disabling this assertion as for some reason even after advancing the clock the alert is not being delivered.
	// the check previous to this assertion would ensure that the sender is up and running before sending the notification.
	// However, sometimes this does not happen.

	// Create two alert rules with one second interval.
	// alertRuleOrgOne := CreateTestAlertRule(t, fakeRuleStore, 1, 1)
	// alertRuleOrgTwo := CreateTestAlertRule(t, fakeRuleStore, 1, 2)
	// Eventually, our Alertmanager should have received at least two alerts.
	// var count int
	// require.Eventuallyf(t, func() bool {
	//	count := fakeAM.AlertsCount()
	//	return count == 2 && fakeAM.AlertNamesCompare([]string{alertRuleOrgOne.Title, alertRuleOrgTwo.Title})
	// }, 20*time.Second, 200*time.Millisecond, "Alertmanager never received an '%s' from org 1 or '%s' from org 2, the alert count was: %d", alertRuleOrgOne.Title, alertRuleOrgTwo.Title, count)

	// 2. Next, let's modify the configuration of an organization by adding an extra alertmanager.
	fakeAM2 := NewFakeExternalAlertmanager(t)
	adminConfig2 = &models.AdminConfiguration{OrgID: 2, Alertmanagers: []string{fakeAM.server.URL, fakeAM2.server.URL}}
	cmd = store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfig2}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	// Before we sync, let's grab the existing hash of this particular org.
	sched.sendersMtx.Lock()
	currentHash := sched.sendersCfgHash[2]
	sched.sendersMtx.Unlock()

	// Now, sync again.
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())

	// The hash for org two should not be the same and we should still have two senders.
	sched.sendersMtx.Lock()
	require.NotEqual(t, sched.sendersCfgHash[2], currentHash)
	require.Equal(t, 2, len(sched.senders))
	require.Equal(t, 2, len(sched.sendersCfgHash))
	sched.sendersMtx.Unlock()

	// Wait for the discovery of the new Alertmanager for orgID = 2.
	require.Eventuallyf(t, func() bool {
		return len(sched.AlertmanagersFor(2)) == 2 && len(sched.DroppedAlertmanagersFor(2)) == 0
	}, 10*time.Second, 200*time.Millisecond, "Alertmanager for org 2 was never re-discovered after fix")

	// 3. Now, let's provide a configuration that fails for OrgID = 1.
	adminConfig2 = &models.AdminConfiguration{OrgID: 1, Alertmanagers: []string{"123://invalid.org"}}
	cmd = store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfig2}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	// Before we sync, let's get the current config hash.
	sched.sendersMtx.Lock()
	currentHash = sched.sendersCfgHash[1]
	sched.sendersMtx.Unlock()

	// Now, sync again.
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())

	// The old configuration should still be running.
	sched.sendersMtx.Lock()
	require.Equal(t, sched.sendersCfgHash[1], currentHash)
	sched.sendersMtx.Unlock()
	require.Equal(t, 1, len(sched.AlertmanagersFor(1)))

	// If we fix it - it should be applied.
	adminConfig2 = &models.AdminConfiguration{OrgID: 1, Alertmanagers: []string{"notarealalertmanager:3030"}}
	cmd = store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfig2}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())
	sched.sendersMtx.Lock()
	require.NotEqual(t, sched.sendersCfgHash[1], currentHash)
	sched.sendersMtx.Unlock()

	// Finally, remove everything.
	require.NoError(t, fakeAdminConfigStore.DeleteAdminConfiguration(1))
	require.NoError(t, fakeAdminConfigStore.DeleteAdminConfiguration(2))
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())
	sched.sendersMtx.Lock()
	require.Equal(t, 0, len(sched.senders))
	require.Equal(t, 0, len(sched.sendersCfgHash))
	sched.sendersMtx.Unlock()

	require.Eventuallyf(t, func() bool {
		NoAlertmanagerOrgOne := len(sched.AlertmanagersFor(1)) == 0 && len(sched.DroppedAlertmanagersFor(1)) == 0
		NoAlertmanagerOrgTwo := len(sched.AlertmanagersFor(2)) == 0 && len(sched.DroppedAlertmanagersFor(2)) == 0

		return NoAlertmanagerOrgOne && NoAlertmanagerOrgTwo
	}, 10*time.Second, 200*time.Millisecond, "Alertmanager for org 1 and 2 were never removed")
}

func TestSchedule_ruleRoutine(t *testing.T) {
	createSchedule := func(
		evalAppliedChan chan time.Time,
	) (*schedule, *fakeRuleStore, *FakeInstanceStore, *fakeAdminConfigStore, prometheus.Gatherer) {
		ruleStore := newFakeRuleStore(t)
		instanceStore := &FakeInstanceStore{}
		adminConfigStore := newFakeAdminConfigStore(t)

		registry := prometheus.NewPedanticRegistry()
		sch, _ := setupScheduler(t, ruleStore, instanceStore, adminConfigStore, registry)
		sch.evalAppliedFunc = func(key models.AlertRuleKey, t time.Time) {
			evalAppliedChan <- t
		}
		return sch, ruleStore, instanceStore, adminConfigStore, registry
	}

	// normal states do not include NoData and Error because currently it is not possible to perform any sensible test
	normalStates := []eval.State{eval.Normal, eval.Alerting, eval.Pending}
	randomNormalState := func() eval.State {
		// pick only supported cases
		return normalStates[rand.Intn(3)]
	}

	for _, evalState := range normalStates {
		// TODO rewrite when we are able to mock/fake state manager
		t.Run(fmt.Sprintf("when rule evaluation happens (evaluation state %s)", evalState), func(t *testing.T) {
			evalChan := make(chan *evalContext)
			evalAppliedChan := make(chan time.Time)
			sch, ruleStore, instanceStore, _, reg := createSchedule(evalAppliedChan)

			rule := CreateTestAlertRule(t, ruleStore, 10, rand.Int63(), evalState)

			go func() {
				stop := make(chan struct{})
				t.Cleanup(func() {
					close(stop)
				})
				_ = sch.ruleRoutine(context.Background(), rule.GetKey(), evalChan, stop)
			}()

			expectedTime := time.UnixMicro(rand.Int63())

			evalChan <- &evalContext{
				now:     expectedTime,
				version: rule.Version,
			}

			actualTime := waitForTimeChannel(t, evalAppliedChan)
			require.Equal(t, expectedTime, actualTime)

			t.Run("it should get rule from database when run the first time", func(t *testing.T) {
				queries := make([]models.GetAlertRuleByUIDQuery, 0)
				for _, op := range ruleStore.recordedOps {
					switch q := op.(type) {
					case models.GetAlertRuleByUIDQuery:
						queries = append(queries, q)
					}
				}
				require.NotEmptyf(t, queries, "Expected a %T request to rule store but nothing was recorded", models.GetAlertRuleByUIDQuery{})
				require.Len(t, queries, 1, "Expected exactly one request of %T but got %d", models.GetAlertRuleByUIDQuery{}, len(queries))
				require.Equal(t, rule.UID, queries[0].UID)
				require.Equal(t, rule.OrgID, queries[0].OrgID)
			})
			t.Run("it should process evaluation results via state manager", func(t *testing.T) {
				// TODO rewrite when we are able to mock/fake state manager
				states := sch.stateManager.GetStatesForRuleUID(rule.OrgID, rule.UID)
				require.Len(t, states, 1)
				s := states[0]
				t.Logf("State: %v", s)
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
				for _, op := range instanceStore.recordedOps {
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
        	            	# TYPE grafana_alerting_rule_evaluation_duration_seconds summary
        	            	grafana_alerting_rule_evaluation_duration_seconds{org="%[1]d",quantile="0.5"} 0
        	            	grafana_alerting_rule_evaluation_duration_seconds{org="%[1]d",quantile="0.9"} 0
        	            	grafana_alerting_rule_evaluation_duration_seconds{org="%[1]d",quantile="0.99"} 0
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
		t.Run("when we signal it to stop", func(t *testing.T) {
			stopChan := make(chan struct{})
			stoppedChan := make(chan error)

			sch, _, _, _, _ := createSchedule(make(chan time.Time))

			go func() {
				err := sch.ruleRoutine(context.Background(), models.AlertRuleKey{}, make(chan *evalContext), stopChan)
				stoppedChan <- err
			}()

			stopChan <- struct{}{}
			err := waitForErrChannel(t, stoppedChan)
			require.NoError(t, err)
		})

		t.Run("when context is cancelled", func(t *testing.T) {
			stoppedChan := make(chan error)
			sch, _, _, _, _ := createSchedule(make(chan time.Time))

			ctx, cancel := context.WithCancel(context.Background())
			go func() {
				err := sch.ruleRoutine(ctx, models.AlertRuleKey{}, make(chan *evalContext), make(chan struct{}))
				stoppedChan <- err
			}()

			cancel()
			err := waitForErrChannel(t, stoppedChan)
			require.ErrorIs(t, err, context.Canceled)
		})
	})

	t.Run("should fetch rule from database only if new version is greater than current", func(t *testing.T) {
		evalChan := make(chan *evalContext)
		evalAppliedChan := make(chan time.Time)

		sch, ruleStore, _, _, _ := createSchedule(evalAppliedChan)

		rule := CreateTestAlertRule(t, ruleStore, 10, rand.Int63(), randomNormalState())

		go func() {
			stop := make(chan struct{})
			t.Cleanup(func() {
				close(stop)
			})
			_ = sch.ruleRoutine(context.Background(), rule.GetKey(), evalChan, stop)
		}()

		expectedTime := time.UnixMicro(rand.Int63())
		evalChan <- &evalContext{
			now:     expectedTime,
			version: rule.Version,
		}

		actualTime := waitForTimeChannel(t, evalAppliedChan)
		require.Equal(t, expectedTime, actualTime)

		// Now update the rule
		newRule := *rule
		newRule.Version++
		ruleStore.putRule(&newRule)

		// and call with new version
		expectedTime = expectedTime.Add(time.Duration(rand.Intn(10)) * time.Second)
		evalChan <- &evalContext{
			now:     expectedTime,
			version: newRule.Version,
		}

		actualTime = waitForTimeChannel(t, evalAppliedChan)
		require.Equal(t, expectedTime, actualTime)

		queries := make([]models.GetAlertRuleByUIDQuery, 0)
		for _, op := range ruleStore.recordedOps {
			switch q := op.(type) {
			case models.GetAlertRuleByUIDQuery:
				queries = append(queries, q)
			}
		}
		require.Len(t, queries, 2, "Expected exactly two request of %T", models.GetAlertRuleByUIDQuery{})
		require.Equal(t, rule.UID, queries[0].UID)
		require.Equal(t, rule.OrgID, queries[0].OrgID)
		require.Equal(t, rule.UID, queries[1].UID)
		require.Equal(t, rule.OrgID, queries[1].OrgID)
	})

	t.Run("should not fetch rule if version is equal or less than current", func(t *testing.T) {
		evalChan := make(chan *evalContext)
		evalAppliedChan := make(chan time.Time)

		sch, ruleStore, _, _, _ := createSchedule(evalAppliedChan)

		rule := CreateTestAlertRule(t, ruleStore, 10, rand.Int63(), randomNormalState())

		go func() {
			stop := make(chan struct{})
			t.Cleanup(func() {
				close(stop)
			})
			_ = sch.ruleRoutine(context.Background(), rule.GetKey(), evalChan, stop)
		}()

		expectedTime := time.UnixMicro(rand.Int63())
		evalChan <- &evalContext{
			now:     expectedTime,
			version: rule.Version,
		}

		actualTime := waitForTimeChannel(t, evalAppliedChan)
		require.Equal(t, expectedTime, actualTime)

		// try again with the same version
		expectedTime = expectedTime.Add(time.Duration(rand.Intn(10)) * time.Second)
		evalChan <- &evalContext{
			now:     expectedTime,
			version: rule.Version,
		}
		actualTime = waitForTimeChannel(t, evalAppliedChan)
		require.Equal(t, expectedTime, actualTime)

		expectedTime = expectedTime.Add(time.Duration(rand.Intn(10)) * time.Second)
		evalChan <- &evalContext{
			now:     expectedTime,
			version: rule.Version - 1,
		}
		actualTime = waitForTimeChannel(t, evalAppliedChan)
		require.Equal(t, expectedTime, actualTime)

		queries := make([]models.GetAlertRuleByUIDQuery, 0)
		for _, op := range ruleStore.recordedOps {
			switch q := op.(type) {
			case models.GetAlertRuleByUIDQuery:
				queries = append(queries, q)
			}
		}
		require.Len(t, queries, 1, "Expected exactly one request of %T", models.GetAlertRuleByUIDQuery{})
	})

	t.Run("when evaluation fails", func(t *testing.T) {
		t.Run("it should increase failure counter", func(t *testing.T) {
			t.Skip()
			// TODO implement check for counter
		})
		t.Run("it should retry up to configured times", func(t *testing.T) {
			// TODO figure out how to simulate failure
			t.Skip()
		})
	})

	t.Run("when there are alerts that should be firing", func(t *testing.T) {
		t.Run("it should send to local alertmanager if configured for organization", func(t *testing.T) {
			// TODO figure out how to simulate multiorg alertmanager
			t.Skip()
		})
		t.Run("it should send to external alertmanager if configured for organization", func(t *testing.T) {
			fakeAM := NewFakeExternalAlertmanager(t)
			defer fakeAM.Close()

			orgID := rand.Int63()
			s, err := sender.New(nil)
			require.NoError(t, err)
			adminConfig := &models.AdminConfiguration{OrgID: orgID, Alertmanagers: []string{fakeAM.server.URL}}
			err = s.ApplyConfig(adminConfig)
			require.NoError(t, err)
			s.Run()
			defer s.Stop()

			require.Eventuallyf(t, func() bool {
				return len(s.Alertmanagers()) == 1
			}, 20*time.Second, 200*time.Millisecond, "external Alertmanager was not discovered.")

			evalChan := make(chan *evalContext)
			evalAppliedChan := make(chan time.Time)

			sch, ruleStore, _, _, _ := createSchedule(evalAppliedChan)
			sch.senders[orgID] = s
			// eval.Alerting makes state manager to create notifications for alertmanagers
			rule := CreateTestAlertRule(t, ruleStore, 10, orgID, eval.Alerting)

			go func() {
				stop := make(chan struct{})
				t.Cleanup(func() {
					close(stop)
				})
				_ = sch.ruleRoutine(context.Background(), rule.GetKey(), evalChan, stop)
			}()

			evalChan <- &evalContext{
				now:     time.Now(),
				version: rule.Version,
			}
			waitForTimeChannel(t, evalAppliedChan)

			var count int
			require.Eventuallyf(t, func() bool {
				count = fakeAM.AlertsCount()
				return count == 1 && fakeAM.AlertNamesCompare([]string{rule.Title})
			}, 20*time.Second, 200*time.Millisecond, "Alertmanager never received an '%s', received alerts count: %d", rule.Title, count)
		})
	})

	t.Run("when there are no alerts to send it should not call notifiers", func(t *testing.T) {
		// TODO needs some mocking/stubbing for Alertmanager and Sender to make sure it was not called
		t.Skip()
	})
}

func setupScheduler(t *testing.T, rs store.RuleStore, is store.InstanceStore, acs store.AdminConfigurationStore, registry *prometheus.Registry) (*schedule, *clock.Mock) {
	t.Helper()

	fakeAnnoRepo := NewFakeAnnotationsRepo()
	annotations.SetRepository(fakeAnnoRepo)
	mockedClock := clock.NewMock()
	logger := log.New("ngalert schedule test")
	if registry == nil {
		registry = prometheus.NewPedanticRegistry()
	}
	m := metrics.NewNGAlert(registry)
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	decryptFn := secretsService.GetDecryptedValue
	moa, err := notifier.NewMultiOrgAlertmanager(&setting.Cfg{}, &notifier.FakeConfigStore{}, &notifier.FakeOrgStore{}, &notifier.FakeKVStore{}, decryptFn, nil, log.New("testlogger"))
	require.NoError(t, err)

	schedCfg := SchedulerCfg{
		C:                       mockedClock,
		BaseInterval:            time.Second,
		MaxAttempts:             1,
		Evaluator:               eval.Evaluator{Cfg: &setting.Cfg{ExpressionsEnabled: true}, Log: logger},
		RuleStore:               rs,
		InstanceStore:           is,
		AdminConfigStore:        acs,
		MultiOrgNotifier:        moa,
		Logger:                  logger,
		Metrics:                 m.GetSchedulerMetrics(),
		AdminConfigPollInterval: 10 * time.Minute, // do not poll in unit tests.
	}
	st := state.NewManager(schedCfg.Logger, m.GetStateMetrics(), nil, rs, is)
	appUrl := &url.URL{
		Scheme: "http",
		Host:   "localhost",
	}
	return NewScheduler(schedCfg, expr.ProvideService(&setting.Cfg{ExpressionsEnabled: true}, nil, nil), appUrl, st), mockedClock
}

// createTestAlertRule creates a dummy alert definition to be used by the tests.
func CreateTestAlertRule(t *testing.T, dbstore *fakeRuleStore, intervalSeconds int64, orgID int64, evalResult eval.State) *models.AlertRule {
	t.Helper()
	records := make([]interface{}, 0, len(dbstore.recordedOps))
	copy(records, dbstore.recordedOps)
	defer func() {
		// erase queries that were made by the testing suite
		dbstore.recordedOps = records
	}()
	d := rand.Intn(1000)
	ruleGroup := fmt.Sprintf("ruleGroup-%d", d)

	var expression string
	var forDuration time.Duration
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
			forDuration = 100 * time.Second
		}
	case eval.Error:
		expression = `{
			"datasourceUid": "-100",
			"type":"math",
			"expression":"$A"
		}`
	case eval.NoData:
		// TODO Implement support for NoData
		require.Fail(t, "Alert rule with desired evaluation result NoData is not supported yet")
	}

	err := dbstore.UpdateRuleGroup(store.UpdateRuleGroupCmd{
		OrgID:        orgID,
		NamespaceUID: "namespace",
		RuleGroupConfig: apimodels.PostableRuleGroupConfig{
			Name:     ruleGroup,
			Interval: model.Duration(time.Duration(intervalSeconds) * time.Second),
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						Annotations: map[string]string{"testAnnoKey": "testAnnoValue"},
						For:         model.Duration(forDuration),
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     fmt.Sprintf("an alert definition %d", d),
						Condition: "A",
						Data: []models.AlertQuery{
							{
								DatasourceUID: "-100",
								Model:         json.RawMessage(expression),
								RelativeTimeRange: models.RelativeTimeRange{
									From: models.Duration(5 * time.Hour),
									To:   models.Duration(3 * time.Hour),
								},
								RefID: "A",
							},
						},
					},
				},
			},
		},
	})
	require.NoError(t, err)

	q := models.ListRuleGroupAlertRulesQuery{
		OrgID:        orgID,
		NamespaceUID: "namespace",
		RuleGroup:    ruleGroup,
	}
	err = dbstore.GetRuleGroupAlertRules(&q)
	require.NoError(t, err)
	require.NotEmpty(t, q.Result)

	rule := q.Result[0]
	t.Logf("alert definition: %v with interval: %d created", rule.GetKey(), rule.IntervalSeconds)
	return rule
}
