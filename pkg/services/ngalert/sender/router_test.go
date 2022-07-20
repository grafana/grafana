package sender

import (
	"context"
	"fmt"
	"math/rand"
	"net/url"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/go-openapi/strfmt"
	models2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestSendingToExternalAlertmanager(t *testing.T) {
	ruleKey := models.GenerateRuleKey(1)

	fakeAM := NewFakeExternalAlertmanager(t)
	defer fakeAM.Close()

	fakeAdminConfigStore := &store.AdminConfigurationStoreMock{}
	mockedGetAdminConfigurations := fakeAdminConfigStore.EXPECT().GetAdminConfigurations()

	mockedClock := clock.NewMock()

	moa := createMultiOrgAlertmanager(t, []int64{1})

	appUrl := &url.URL{
		Scheme: "http",
		Host:   "localhost",
	}

	alertsRouter := NewAlertsRouter(moa, fakeAdminConfigStore, mockedClock, appUrl, map[int64]struct{}{}, 10*time.Minute)

	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey.OrgID, Alertmanagers: []string{fakeAM.Server.URL}, SendAlertsTo: models.AllAlertmanagers},
	}, nil)
	// Make sure we sync the configuration at least once before the evaluation happens to guarantee the sender is running
	// when the first alert triggers.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase())
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagersCfgHash))

	// Then, ensure we've discovered the Alertmanager.
	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey.OrgID, 1, 0)

	var expected []*models2.PostableAlert
	alerts := definitions.PostableAlerts{}
	for i := 0; i < rand.Intn(5)+1; i++ {
		alert := generatePostableAlert(t, mockedClock)
		expected = append(expected, &alert)
		alerts.PostableAlerts = append(alerts.PostableAlerts, alert)
	}

	alertsRouter.Send(ruleKey, alerts)

	// Eventually, our Alertmanager should have received at least one alert.
	assertAlertsDelivered(t, fakeAM, expected)

	// Now, let's remove the Alertmanager from the admin configuration.
	mockedGetAdminConfigurations.Return(nil, nil)
	// Again, make sure we sync and verify the externalAlertmanagers.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase())
	require.Equal(t, 0, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 0, len(alertsRouter.externalAlertmanagersCfgHash))

	// Then, ensure we've dropped the Alertmanager.
	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey.OrgID, 0, 0)
}

func TestSendingToExternalAlertmanager_WithMultipleOrgs(t *testing.T) {
	ruleKey1 := models.GenerateRuleKey(1)
	ruleKey2 := models.GenerateRuleKey(2)

	fakeAM := NewFakeExternalAlertmanager(t)
	defer fakeAM.Close()

	fakeAdminConfigStore := &store.AdminConfigurationStoreMock{}
	mockedGetAdminConfigurations := fakeAdminConfigStore.EXPECT().GetAdminConfigurations()

	mockedClock := clock.NewMock()

	moa := createMultiOrgAlertmanager(t, []int64{1, 2})

	appUrl := &url.URL{
		Scheme: "http",
		Host:   "localhost",
	}

	alertsRouter := NewAlertsRouter(moa, fakeAdminConfigStore, mockedClock, appUrl, map[int64]struct{}{}, 10*time.Minute)

	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey1.OrgID, Alertmanagers: []string{fakeAM.Server.URL}, SendAlertsTo: models.AllAlertmanagers},
	}, nil)

	// Make sure we sync the configuration at least once before the evaluation happens to guarantee the sender is running
	// when the first alert triggers.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase())
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagersCfgHash))

	// Then, ensure we've discovered the Alertmanager.
	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey1.OrgID, 1, 0)

	// 1. Now, let's assume a new org comes along.
	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey1.OrgID, Alertmanagers: []string{fakeAM.Server.URL}, SendAlertsTo: models.AllAlertmanagers},
		{OrgID: ruleKey2.OrgID, Alertmanagers: []string{fakeAM.Server.URL}},
	}, nil)

	// If we sync again, new externalAlertmanagers must have spawned.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase())
	require.Equal(t, 2, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 2, len(alertsRouter.externalAlertmanagersCfgHash))

	// Then, ensure we've discovered the Alertmanager for the new organization.
	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey1.OrgID, 1, 0)
	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey2.OrgID, 1, 0)

	var expected []*models2.PostableAlert
	alerts1 := definitions.PostableAlerts{}
	for i := 0; i < rand.Intn(5)+1; i++ {
		alert := generatePostableAlert(t, mockedClock)
		expected = append(expected, &alert)
		alerts1.PostableAlerts = append(alerts1.PostableAlerts, alert)
	}
	alerts2 := definitions.PostableAlerts{}
	for i := 0; i < rand.Intn(5)+1; i++ {
		alert := generatePostableAlert(t, mockedClock)
		expected = append(expected, &alert)
		alerts2.PostableAlerts = append(alerts2.PostableAlerts, alert)
	}

	alertsRouter.Send(ruleKey1, alerts1)
	alertsRouter.Send(ruleKey2, alerts2)

	assertAlertsDelivered(t, fakeAM, expected)

	// 2. Next, let's modify the configuration of an organization by adding an extra alertmanager.
	fakeAM2 := NewFakeExternalAlertmanager(t)

	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey1.OrgID, Alertmanagers: []string{fakeAM.Server.URL}, SendAlertsTo: models.AllAlertmanagers},
		{OrgID: ruleKey2.OrgID, Alertmanagers: []string{fakeAM.Server.URL, fakeAM2.Server.URL}},
	}, nil)

	// Before we sync, let's grab the existing hash of this particular org.
	currentHash := alertsRouter.externalAlertmanagersCfgHash[ruleKey2.OrgID]

	// Now, sync again.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase())

	// The hash for org two should not be the same and we should still have two externalAlertmanagers.
	require.NotEqual(t, alertsRouter.externalAlertmanagersCfgHash[ruleKey2.OrgID], currentHash)
	require.Equal(t, 2, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 2, len(alertsRouter.externalAlertmanagersCfgHash))

	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey2.OrgID, 2, 0)

	// 3. Now, let's provide a configuration that fails for OrgID = 1.
	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey1.OrgID, Alertmanagers: []string{"123://invalid.org"}, SendAlertsTo: models.AllAlertmanagers},
		{OrgID: ruleKey2.OrgID, Alertmanagers: []string{fakeAM.Server.URL, fakeAM2.Server.URL}},
	}, nil)

	// Before we sync, let's get the current config hash.
	currentHash = alertsRouter.externalAlertmanagersCfgHash[ruleKey1.OrgID]

	// Now, sync again.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase())

	// The old configuration should still be running.
	require.Equal(t, alertsRouter.externalAlertmanagersCfgHash[ruleKey1.OrgID], currentHash)
	require.Equal(t, 1, len(alertsRouter.AlertmanagersFor(ruleKey1.OrgID)))

	// If we fix it - it should be applied.
	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey1.OrgID, Alertmanagers: []string{"notarealalertmanager:3030"}, SendAlertsTo: models.AllAlertmanagers},
		{OrgID: ruleKey2.OrgID, Alertmanagers: []string{fakeAM.Server.URL, fakeAM2.Server.URL}},
	}, nil)

	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase())
	require.NotEqual(t, alertsRouter.externalAlertmanagersCfgHash[ruleKey1.OrgID], currentHash)

	// Finally, remove everything.
	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{}, nil)

	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase())

	require.Equal(t, 0, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 0, len(alertsRouter.externalAlertmanagersCfgHash))

	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey1.OrgID, 0, 0)
	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey2.OrgID, 0, 0)
}

func TestChangingAlertmanagersChoice(t *testing.T) {
	ruleKey := models.GenerateRuleKey(1)

	fakeAM := NewFakeExternalAlertmanager(t)
	defer fakeAM.Close()

	fakeAdminConfigStore := &store.AdminConfigurationStoreMock{}
	mockedGetAdminConfigurations := fakeAdminConfigStore.EXPECT().GetAdminConfigurations()

	mockedClock := clock.NewMock()
	mockedClock.Set(time.Now())

	moa := createMultiOrgAlertmanager(t, []int64{1})

	appUrl := &url.URL{
		Scheme: "http",
		Host:   "localhost",
	}

	alertsRouter := NewAlertsRouter(moa, fakeAdminConfigStore, mockedClock, appUrl, map[int64]struct{}{}, 10*time.Minute)

	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey.OrgID, Alertmanagers: []string{fakeAM.Server.URL}, SendAlertsTo: models.AllAlertmanagers},
	}, nil)
	// Make sure we sync the configuration at least once before the evaluation happens to guarantee the sender is running
	// when the first alert triggers.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase())
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagersCfgHash))
	require.Equal(t, models.AllAlertmanagers, alertsRouter.sendAlertsTo[ruleKey.OrgID])

	// Then, ensure we've discovered the Alertmanager.
	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey.OrgID, 1, 0)

	var expected []*models2.PostableAlert
	alerts := definitions.PostableAlerts{}
	for i := 0; i < rand.Intn(5)+1; i++ {
		alert := generatePostableAlert(t, mockedClock)
		expected = append(expected, &alert)
		alerts.PostableAlerts = append(alerts.PostableAlerts, alert)
	}
	alertsRouter.Send(ruleKey, alerts)

	// Eventually, our Alertmanager should have received at least one alert.
	assertAlertsDelivered(t, fakeAM, expected)

	// Now, let's change the Alertmanagers choice to send only to the external Alertmanager.
	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey.OrgID, Alertmanagers: []string{fakeAM.Server.URL}, SendAlertsTo: models.ExternalAlertmanagers},
	}, nil)
	// Again, make sure we sync and verify the externalAlertmanagers.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase())
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagersCfgHash))

	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey.OrgID, 1, 0)
	require.Equal(t, models.ExternalAlertmanagers, alertsRouter.sendAlertsTo[ruleKey.OrgID])

	// Finally, let's change the Alertmanagers choice to send only to the internal Alertmanager.
	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey.OrgID, Alertmanagers: []string{fakeAM.Server.URL}, SendAlertsTo: models.InternalAlertmanager},
	}, nil)

	// Again, make sure we sync and verify the externalAlertmanagers.
	// externalAlertmanagers should be running even though alerts are being handled externally.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase())
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagersCfgHash))

	// Then, ensure the Alertmanager is still listed and the Alertmanagers choice has changed.
	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey.OrgID, 1, 0)
	require.Equal(t, models.InternalAlertmanager, alertsRouter.sendAlertsTo[ruleKey.OrgID])

	alertsRouter.Send(ruleKey, alerts)

	am, err := moa.AlertmanagerFor(ruleKey.OrgID)
	require.NoError(t, err)
	actualAlerts, err := am.GetAlerts(true, true, true, nil, "")
	require.NoError(t, err)
	require.Len(t, actualAlerts, len(expected))
}

func assertAlertmanagersStatusForOrg(t *testing.T, alertsRouter *AlertsRouter, orgID int64, active, dropped int) {
	t.Helper()
	require.Eventuallyf(t, func() bool {
		return len(alertsRouter.AlertmanagersFor(orgID)) == active && len(alertsRouter.DroppedAlertmanagersFor(orgID)) == dropped
	}, 10*time.Second, 200*time.Millisecond,
		fmt.Sprintf("expected %d active Alertmanagers and %d dropped ones but got %d active and %d dropped", active, dropped, len(alertsRouter.AlertmanagersFor(orgID)), len(alertsRouter.DroppedAlertmanagersFor(orgID))))
}

func assertAlertsDelivered(t *testing.T, fakeAM *FakeExternalAlertmanager, expectedAlerts []*models2.PostableAlert) {
	t.Helper()
	require.Eventuallyf(t, func() bool {
		return fakeAM.AlertsCount() == len(expectedAlerts)
	}, 10*time.Second, 200*time.Millisecond, fmt.Sprintf("expected %d alerts to be delivered to remote Alertmanager but only %d was delivered", len(expectedAlerts), fakeAM.AlertsCount()))
	require.Len(t, fakeAM.Alerts(), len(expectedAlerts))
}

func generatePostableAlert(t *testing.T, clk clock.Clock) models2.PostableAlert {
	t.Helper()
	u := url.URL{
		Scheme:  "http",
		Host:    "localhost",
		RawPath: "/" + util.GenerateShortUID(),
	}
	return models2.PostableAlert{
		Annotations: models2.LabelSet(models.GenerateAlertLabels(5, "ann-")),
		EndsAt:      strfmt.DateTime(clk.Now().Add(1 * time.Minute)),
		StartsAt:    strfmt.DateTime(clk.Now()),
		Alert: models2.Alert{
			GeneratorURL: strfmt.URI(u.String()),
			Labels:       models2.LabelSet(models.GenerateAlertLabels(5, "lbl-")),
		},
	}
}

func createMultiOrgAlertmanager(t *testing.T, orgs []int64) *notifier.MultiOrgAlertmanager {
	t.Helper()

	tmpDir := t.TempDir()
	orgStore := notifier.NewFakeOrgStore(t, orgs)

	cfg := &setting.Cfg{
		DataPath: tmpDir,
		UnifiedAlerting: setting.UnifiedAlertingSettings{
			AlertmanagerConfigPollInterval: 3 * time.Minute,
			DefaultConfiguration:           setting.GetAlertmanagerDefaultConfiguration(),
			DisabledOrgs:                   map[int64]struct{}{},
		}, // do not poll in tests.
	}

	cfgStore := notifier.NewFakeConfigStore(t, make(map[int64]*models.AlertConfiguration))
	kvStore := notifier.NewFakeKVStore(t)
	registry := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(registry)
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	decryptFn := secretsService.GetDecryptedValue
	moa, err := notifier.NewMultiOrgAlertmanager(cfg, &cfgStore, &orgStore, kvStore, provisioning.NewFakeProvisioningStore(), decryptFn, m.GetMultiOrgAlertmanagerMetrics(), nil, log.New("testlogger"), secretsService)
	require.NoError(t, err)
	require.NoError(t, moa.LoadAndSyncAlertmanagersForOrgs(context.Background()))
	require.Eventually(t, func() bool {
		for _, org := range orgs {
			_, err := moa.AlertmanagerFor(org)
			if err != nil {
				return false
			}
		}
		return true
	}, 10*time.Second, 100*time.Millisecond)
	return moa
}
