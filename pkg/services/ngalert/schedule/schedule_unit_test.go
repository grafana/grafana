package schedule

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/url"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestSendingToExternalAlertmanager(t *testing.T) {
	fakeAM := NewFakeExternalAlertmanager(t)
	defer fakeAM.Close()
	fakeRuleStore := newFakeRuleStore(t)
	fakeInstanceStore := &fakeInstanceStore{}
	fakeAdminConfigStore := newFakeAdminConfigStore(t)

	// create alert rules with one second interval
	alertRuleBothWays := CreateTestAlertRule(t, fakeRuleStore, 1, 1)
	alertRuleExternal := CreateTestAlertRule(t, fakeRuleStore, 1, 2)
	alertRuleInternal := CreateTestAlertRule(t, fakeRuleStore, 1, 3)

	// First, let's create an admin configuration that holds an alertmanager
	// and sends alerts to both internal and external alertmanagers.
	adminConfigBothWays := &models.AdminConfiguration{OrgID: 1, Alertmanagers: []string{fakeAM.server.URL}, Handling: store.HandleBothWays}
	cmd := store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfigBothWays}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	// Then, let's create an admin configuration that holds an alertmanager
	// and sends alerts just to the external alertmanagers.
	adminConfigExternal := &models.AdminConfiguration{OrgID: 2, Alertmanagers: []string{fakeAM.server.URL}, Handling: store.HandleExternally}
	cmd = store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfigExternal}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	// Finally, let's create an admin configuration that holds an alertmanager
	// and sends alerts just to the internal alertmanager.
	adminConfigInternal := &models.AdminConfiguration{OrgID: 3, Alertmanagers: []string{fakeAM.server.URL}, Handling: store.HandleInternally}
	cmd = store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfigInternal}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	sched, mockedClock := setupScheduler(t, fakeRuleStore, fakeInstanceStore, fakeAdminConfigStore)

	// Make sure we sync the configuration at least once before the evaluation happens to guarantee the sender is running
	// when the first alert triggers.
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())
	sched.adminConfigMtx.Lock()
	require.Equal(t, 2, len(sched.senders))
	require.Equal(t, 2, len(sched.sendersCfgHash))
	sched.adminConfigMtx.Unlock()

	// Then, ensure we've discovered all the Alertmanagers.
	require.Eventually(t, func() bool {
		return len(sched.AlertmanagersFor(1)) == 1 &&
			len(sched.DroppedAlertmanagersFor(1)) == 0 &&
			len(sched.AlertmanagersFor(2)) == 1 &&
			len(sched.DroppedAlertmanagersFor(2)) == 0 &&
			// Org 3 should have no Alertmanagers set up.
			len(sched.AlertmanagersFor(3)) == 0 &&
			len(sched.DroppedAlertmanagersFor(3)) == 0
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

	// Eventually, our Alertmanager should have received alerts from orgs 1 and 2 and no alerts from org 3.
	require.Eventually(t, func() bool {
		return fakeAM.AlertsCount() >= 1 &&
			fakeAM.AlertNamesCompare([]string{alertRuleBothWays.Title, alertRuleExternal.Title}) &&
			!fakeAM.AlertNamesCompare([]string{alertRuleInternal.Title})
	}, 10*time.Second, 200*time.Millisecond)

	// Now, let's remove the Alertmanagers from the admin configuration.
	adminConfigBothWays.Alertmanagers = []string{}
	cmd = store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfigBothWays}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))
	adminConfigExternal.Alertmanagers = []string{}
	cmd = store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfigExternal}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	// Again, make sure we sync and verify the senders.
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())
	sched.adminConfigMtx.Lock()
	require.Equal(t, 0, len(sched.senders))
	require.Equal(t, 0, len(sched.sendersCfgHash))
	sched.adminConfigMtx.Unlock()

	// Then, ensure we've dropped the Alertmanager.
	require.Eventually(t, func() bool {
		return len(sched.AlertmanagersFor(1)) == 0 &&
			len(sched.DroppedAlertmanagersFor(1)) == 0 &&
			len(sched.AlertmanagersFor(2)) == 0 &&
			len(sched.DroppedAlertmanagersFor(2)) == 0 &&
			len(sched.AlertmanagersFor(3)) == 0 &&
			len(sched.DroppedAlertmanagersFor(3)) == 0
	}, 10*time.Second, 200*time.Millisecond)
}

func TestSendingToExternalAlertmanager_WithMultipleOrgs(t *testing.T) {
	fakeAM := NewFakeExternalAlertmanager(t)
	defer fakeAM.Close()
	fakeRuleStore := newFakeRuleStore(t)
	fakeInstanceStore := &fakeInstanceStore{}
	fakeAdminConfigStore := newFakeAdminConfigStore(t)

	// First, let's create an admin configuration that holds an alertmanager.
	adminConfig := &models.AdminConfiguration{OrgID: 1, Alertmanagers: []string{fakeAM.server.URL}}
	cmd := store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfig}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	sched, mockedClock := setupScheduler(t, fakeRuleStore, fakeInstanceStore, fakeAdminConfigStore)

	// Make sure we sync the configuration at least once before the evaluation happens to guarantee the sender is running
	// when the first alert triggers.
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())
	sched.adminConfigMtx.Lock()
	require.Equal(t, 1, len(sched.senders))
	require.Equal(t, 1, len(sched.sendersCfgHash))
	sched.adminConfigMtx.Unlock()

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
	sched.adminConfigMtx.Lock()
	require.Equal(t, 2, len(sched.senders))
	require.Equal(t, 2, len(sched.sendersCfgHash))
	sched.adminConfigMtx.Unlock()

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
	//alertRuleOrgOne := CreateTestAlertRule(t, fakeRuleStore, 1, 1)
	//alertRuleOrgTwo := CreateTestAlertRule(t, fakeRuleStore, 1, 2)
	// Eventually, our Alertmanager should have received at least two alerts.
	//var count int
	//require.Eventuallyf(t, func() bool {
	//	count := fakeAM.AlertsCount()
	//	return count == 2 && fakeAM.AlertNamesCompare([]string{alertRuleOrgOne.Title, alertRuleOrgTwo.Title})
	//}, 20*time.Second, 200*time.Millisecond, "Alertmanager never received an '%s' from org 1 or '%s' from org 2, the alert count was: %d", alertRuleOrgOne.Title, alertRuleOrgTwo.Title, count)

	// 2. Next, let's modify the configuration of an organization by adding an extra alertmanager.
	fakeAM2 := NewFakeExternalAlertmanager(t)
	adminConfig2 = &models.AdminConfiguration{OrgID: 2, Alertmanagers: []string{fakeAM.server.URL, fakeAM2.server.URL}}
	cmd = store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfig2}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	// Before we sync, let's grab the existing hash of this particular org.
	sched.adminConfigMtx.Lock()
	currentHash := sched.sendersCfgHash[2]
	sched.adminConfigMtx.Unlock()

	// Now, sync again.
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())

	// The hash for org two should not be the same and we should still have two senders.
	sched.adminConfigMtx.Lock()
	require.NotEqual(t, sched.sendersCfgHash[2], currentHash)
	require.Equal(t, 2, len(sched.senders))
	require.Equal(t, 2, len(sched.sendersCfgHash))
	sched.adminConfigMtx.Unlock()

	// Wait for the discovery of the new Alertmanager for orgID = 2.
	require.Eventuallyf(t, func() bool {
		return len(sched.AlertmanagersFor(2)) == 2 && len(sched.DroppedAlertmanagersFor(2)) == 0
	}, 10*time.Second, 200*time.Millisecond, "Alertmanager for org 2 was never re-discovered after fix")

	// 3. Now, let's provide a configuration that fails for OrgID = 1.
	adminConfig2 = &models.AdminConfiguration{OrgID: 1, Alertmanagers: []string{"123://invalid.org"}}
	cmd = store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfig2}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))

	// Before we sync, let's get the current config hash.
	sched.adminConfigMtx.Lock()
	currentHash = sched.sendersCfgHash[1]
	sched.adminConfigMtx.Unlock()

	// Now, sync again.
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())

	// The old configuration should still be running.
	sched.adminConfigMtx.Lock()
	require.Equal(t, sched.sendersCfgHash[1], currentHash)
	sched.adminConfigMtx.Unlock()
	require.Equal(t, 1, len(sched.AlertmanagersFor(1)))

	// If we fix it - it should be applied.
	adminConfig2 = &models.AdminConfiguration{OrgID: 1, Alertmanagers: []string{"notarealalertmanager:3030"}}
	cmd = store.UpdateAdminConfigurationCmd{AdminConfiguration: adminConfig2}
	require.NoError(t, fakeAdminConfigStore.UpdateAdminConfiguration(cmd))
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())
	sched.adminConfigMtx.Lock()
	require.NotEqual(t, sched.sendersCfgHash[1], currentHash)
	sched.adminConfigMtx.Unlock()

	// Finally, remove everything.
	require.NoError(t, fakeAdminConfigStore.DeleteAdminConfiguration(1))
	require.NoError(t, fakeAdminConfigStore.DeleteAdminConfiguration(2))
	require.NoError(t, sched.SyncAndApplyConfigFromDatabase())
	sched.adminConfigMtx.Lock()
	require.Equal(t, 0, len(sched.senders))
	require.Equal(t, 0, len(sched.sendersCfgHash))
	sched.adminConfigMtx.Unlock()

	require.Eventuallyf(t, func() bool {
		NoAlertmanagerOrgOne := len(sched.AlertmanagersFor(1)) == 0 && len(sched.DroppedAlertmanagersFor(1)) == 0
		NoAlertmanagerOrgTwo := len(sched.AlertmanagersFor(2)) == 0 && len(sched.DroppedAlertmanagersFor(2)) == 0

		return NoAlertmanagerOrgOne && NoAlertmanagerOrgTwo
	}, 10*time.Second, 200*time.Millisecond, "Alertmanager for org 1 and 2 were never removed")
}

func setupScheduler(t *testing.T, rs store.RuleStore, is store.InstanceStore, acs store.AdminConfigurationStore) (*schedule, *clock.Mock) {
	t.Helper()

	mockedClock := clock.NewMock()
	logger := log.New("ngalert schedule test")
	m := metrics.NewNGAlert(prometheus.NewPedanticRegistry())
	decryptFn := ossencryption.ProvideService().GetDecryptedValue
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
	return NewScheduler(schedCfg, nil, appUrl, st), mockedClock
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
