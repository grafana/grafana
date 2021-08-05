package schedule

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestSendingToExternalAlertmanager(t *testing.T) {
	t.Cleanup(registry.ClearOverrides)

	fakeAM := newFakeExternalAlertmanager(t)
	defer fakeAM.Close()
	fakeRuleStore := newFakeRuleStore(t)
	fakeInstanceStore := &fakeInstanceStore{}
	fakeAdminConfigStore := newFakeAdminConfigStore(t)

	// create alert rule with one second interval
	alertRule := CreateTestAlertRule(t, fakeRuleStore, 1, 1)

	// First, let's create an admin configuration that holds an alertmanager.
	adminConfig := &models.AdminConfiguration{OrgID: 1, Alertmanagers: []string{fakeAM.server.URL}}
	cmd := store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfig}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	sched, mockedClock := setupScheduler(t, fakeRuleStore, fakeInstanceStore, fakeAdminConfigStore)

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
		AdminConfigPollingInterval = 10 * time.Minute // Do not poll in unit tests.
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
	t.Cleanup(registry.ClearOverrides)

	fakeAM := newFakeExternalAlertmanager(t)
	defer fakeAM.Close()
	fakeRuleStore := newFakeRuleStore(t)
	fakeInstanceStore := &fakeInstanceStore{}
	fakeAdminConfigStore := newFakeAdminConfigStore(t)

	// Create two alert rules with one second interval.
	alertRuleOrgOne := CreateTestAlertRule(t, fakeRuleStore, 1, 1)
	alertRuleOrgTwo := CreateTestAlertRule(t, fakeRuleStore, 1, 2)

	// First, let's create an admin configuration that holds an alertmanager.
	adminConfig := &models.AdminConfiguration{OrgID: 1, Alertmanagers: []string{fakeAM.server.URL}}
	cmd := store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfig}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	sched, mockedClock := setupScheduler(t, fakeRuleStore, fakeInstanceStore, fakeAdminConfigStore)

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
		AdminConfigPollingInterval = 10 * time.Minute // Do not poll in unit tests.
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
	require.Eventually(t, func() bool {
		return len(sched.AlertmanagersFor(2)) == 1 && len(sched.DroppedAlertmanagersFor(2)) == 0
	}, 10*time.Second, 200*time.Millisecond)

	// With everything up and running, let's advance the time to make sure we get at least one alert iteration.
	mockedClock.Add(2 * time.Second)

	// Eventually, our Alertmanager should have received at least two alerts.
	require.Eventually(t, func() bool {
		return fakeAM.AlertsCount() == 2 && fakeAM.AlertNamesCompare([]string{alertRuleOrgOne.Title, alertRuleOrgTwo.Title})
	}, 20*time.Second, 200*time.Millisecond)

	// 2. Next, let's modify the configuration of an organization by adding an extra alertmanager.
	fakeAM2 := newFakeExternalAlertmanager(t)
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
	require.Eventually(t, func() bool {
		return len(sched.AlertmanagersFor(2)) == 2 && len(sched.DroppedAlertmanagersFor(2)) == 0
	}, 10*time.Second, 200*time.Millisecond)

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

	require.Eventually(t, func() bool {
		NoAlertmanagerOrgOne := len(sched.AlertmanagersFor(1)) == 0 && len(sched.DroppedAlertmanagersFor(1)) == 0
		NoAlertmanagerOrgTwo := len(sched.AlertmanagersFor(2)) == 0 && len(sched.DroppedAlertmanagersFor(2)) == 0

		return NoAlertmanagerOrgOne && NoAlertmanagerOrgTwo
	}, 10*time.Second, 200*time.Millisecond)
}

func setupScheduler(t *testing.T, rs store.RuleStore, is store.InstanceStore, acs store.AdminConfigurationStore) (*schedule, *clock.Mock) {
	t.Helper()

	mockedClock := clock.NewMock()
	logger := log.New("ngalert schedule test")
	nilMetrics := metrics.NewMetrics(nil)
	schedCfg := SchedulerCfg{
		C:                mockedClock,
		BaseInterval:     time.Second,
		MaxAttempts:      1,
		Evaluator:        eval.Evaluator{Cfg: &setting.Cfg{ExpressionsEnabled: true}, Log: logger},
		RuleStore:        rs,
		InstanceStore:    is,
		AdminConfigStore: acs,
		Notifier:         &fakeNotifier{},
		Logger:           logger,
		Metrics:          metrics.NewMetrics(prometheus.NewRegistry()),
	}
	st := state.NewManager(schedCfg.Logger, nilMetrics, rs, is)
	return NewScheduler(schedCfg, nil, "http://localhost", st), mockedClock
}

// createTestAlertRule creates a dummy alert definition to be used by the tests.
func CreateTestAlertRule(t *testing.T, dbstore *fakeRuleStore, intervalSeconds int64, orgID int64) *models.AlertRule {
	t.Helper()

	d := rand.Intn(1000)
	ruleGroup := fmt.Sprintf("ruleGroup-%d", d)
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
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     fmt.Sprintf("an alert definition %d", d),
						Condition: "A",
						Data: []models.AlertQuery{
							{
								DatasourceUID: "-100",
								Model: json.RawMessage(`{
										"datasourceUid": "-100",
										"type":"math",
										"expression":"2 + 2 > 1"
									}`),
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
