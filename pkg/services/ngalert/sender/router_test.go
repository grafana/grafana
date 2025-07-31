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

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/datasources"
	fake_ds "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	fake_secrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestIntegrationSendingToExternalAlertmanager(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
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

	ds1 := datasources.DataSource{
		URL:   fakeAM.Server.URL,
		OrgID: ruleKey.OrgID,
		Type:  datasources.DS_ALERTMANAGER,
		JsonData: simplejson.NewFromAny(map[string]any{
			"handleGrafanaManagedAlerts": true,
			"implementation":             "prometheus",
		}),
	}
	alertsRouter := NewAlertsRouter(moa, fakeAdminConfigStore, mockedClock, appUrl, map[int64]struct{}{}, 10*time.Minute,
		&fake_ds.FakeDataSourceService{DataSources: []*datasources.DataSource{&ds1}}, fake_secrets.NewFakeSecretsService(), featuremgmt.WithFeatures())

	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey.OrgID, SendAlertsTo: models.AllAlertmanagers},
	}, nil)
	// Make sure we sync the configuration at least once before the evaluation happens to guarantee the sender is running
	// when the first alert triggers.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase(context.Background()))
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

	alertsRouter.Send(context.Background(), ruleKey, alerts)

	// Eventually, our Alertmanager should have received at least one alert.
	assertAlertsDelivered(t, fakeAM, expected)

	// Now, let's remove the Alertmanager from the admin configuration.
	mockedGetAdminConfigurations.Return(nil, nil)
	// Again, make sure we sync and verify the externalAlertmanagers.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase(context.Background()))
	require.Equal(t, 0, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 0, len(alertsRouter.externalAlertmanagersCfgHash))

	// Then, ensure we've dropped the Alertmanager.
	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey.OrgID, 0, 0)
}

func TestIntegrationSendingToExternalAlertmanager_WithMultipleOrgs(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
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

	ds1 := datasources.DataSource{
		URL:   fakeAM.Server.URL,
		OrgID: ruleKey1.OrgID,
		Type:  datasources.DS_ALERTMANAGER,
		JsonData: simplejson.NewFromAny(map[string]any{
			"handleGrafanaManagedAlerts": true,
			"implementation":             "prometheus",
		}),
	}
	fakeDs := &fake_ds.FakeDataSourceService{DataSources: []*datasources.DataSource{&ds1}}
	alertsRouter := NewAlertsRouter(moa, fakeAdminConfigStore, mockedClock, appUrl, map[int64]struct{}{}, 10*time.Minute,
		fakeDs, fake_secrets.NewFakeSecretsService(), featuremgmt.WithFeatures())

	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey1.OrgID, SendAlertsTo: models.AllAlertmanagers},
	}, nil)

	// Make sure we sync the configuration at least once before the evaluation happens to guarantee the sender is running
	// when the first alert triggers.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase(context.Background()))
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagersCfgHash))

	// Then, ensure we've discovered the Alertmanager.
	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey1.OrgID, 1, 0)

	// 1. Now, let's assume a new org comes along.
	ds2 := datasources.DataSource{
		URL:   fakeAM.Server.URL,
		OrgID: ruleKey2.OrgID,
		Type:  datasources.DS_ALERTMANAGER,
		JsonData: simplejson.NewFromAny(map[string]any{
			"handleGrafanaManagedAlerts": true,
			"implementation":             "prometheus",
		}),
	}
	fakeDs.DataSources = append(fakeDs.DataSources, &ds2)

	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey1.OrgID, SendAlertsTo: models.AllAlertmanagers},
		{OrgID: ruleKey2.OrgID},
	}, nil)

	// If we sync again, new externalAlertmanagers must have spawned.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase(context.Background()))
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

	alertsRouter.Send(context.Background(), ruleKey1, alerts1)
	alertsRouter.Send(context.Background(), ruleKey2, alerts2)

	assertAlertsDelivered(t, fakeAM, expected)

	// 2. Next, let's modify the configuration of an organization by adding an extra alertmanager.
	fakeAM2 := NewFakeExternalAlertmanager(t)
	ds3 := datasources.DataSource{
		URL:   fakeAM2.Server.URL,
		OrgID: ruleKey2.OrgID,
		Type:  datasources.DS_ALERTMANAGER,
		JsonData: simplejson.NewFromAny(map[string]any{
			"handleGrafanaManagedAlerts": true,
			"implementation":             "prometheus",
		}),
	}
	fakeDs.DataSources = append(fakeDs.DataSources, &ds3)

	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey1.OrgID, SendAlertsTo: models.AllAlertmanagers},
		{OrgID: ruleKey2.OrgID},
	}, nil)

	// Before we sync, let's grab the existing hash of this particular org.
	currentHash := alertsRouter.externalAlertmanagersCfgHash[ruleKey2.OrgID]

	// Now, sync again.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase(context.Background()))

	// The hash for org two should not be the same and we should still have two externalAlertmanagers.
	require.NotEqual(t, alertsRouter.externalAlertmanagersCfgHash[ruleKey2.OrgID], currentHash)
	require.Equal(t, 2, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 2, len(alertsRouter.externalAlertmanagersCfgHash))

	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey2.OrgID, 2, 0)

	// 3. Now, let's provide a configuration that fails for OrgID = 1.
	fakeDs.DataSources[0].URL = "123://invalid.org"
	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey1.OrgID, SendAlertsTo: models.AllAlertmanagers},
		{OrgID: ruleKey2.OrgID},
	}, nil)

	// Before we sync, let's get the current config hash.
	currentHash = alertsRouter.externalAlertmanagersCfgHash[ruleKey1.OrgID]

	// Now, sync again.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase(context.Background()))

	// The old configuration should not be running.
	require.NotEqual(t, alertsRouter.externalAlertmanagersCfgHash[ruleKey1.OrgID], currentHash)
	require.Equal(t, 0, len(alertsRouter.AlertmanagersFor(ruleKey1.OrgID)))

	// If we fix it - it should be applied.
	fakeDs.DataSources[0].URL = "notarealalertmanager:3030"
	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey1.OrgID, SendAlertsTo: models.AllAlertmanagers},
		{OrgID: ruleKey2.OrgID},
	}, nil)

	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase(context.Background()))
	require.NotEqual(t, alertsRouter.externalAlertmanagersCfgHash[ruleKey1.OrgID], currentHash)

	// Finally, remove everything.
	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{}, nil)

	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase(context.Background()))

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

	ds := datasources.DataSource{
		URL:   fakeAM.Server.URL,
		OrgID: ruleKey.OrgID,
		Type:  datasources.DS_ALERTMANAGER,
		JsonData: simplejson.NewFromAny(map[string]any{
			"handleGrafanaManagedAlerts": true,
			"implementation":             "prometheus",
		}),
	}
	alertsRouter := NewAlertsRouter(moa, fakeAdminConfigStore, mockedClock, appUrl, map[int64]struct{}{},
		10*time.Minute, &fake_ds.FakeDataSourceService{DataSources: []*datasources.DataSource{&ds}}, fake_secrets.NewFakeSecretsService(), featuremgmt.WithFeatures())

	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey.OrgID, SendAlertsTo: models.AllAlertmanagers},
	}, nil)
	// Make sure we sync the configuration at least once before the evaluation happens to guarantee the sender is running
	// when the first alert triggers.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase(context.Background()))
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
	alertsRouter.Send(context.Background(), ruleKey, alerts)

	// Eventually, our Alertmanager should have received at least one alert.
	assertAlertsDelivered(t, fakeAM, expected)

	// Now, let's change the Alertmanagers choice to send only to the external Alertmanager.
	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey.OrgID, SendAlertsTo: models.ExternalAlertmanagers},
	}, nil)
	// Again, make sure we sync and verify the externalAlertmanagers.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase(context.Background()))
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagersCfgHash))

	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey.OrgID, 1, 0)
	require.Equal(t, models.ExternalAlertmanagers, alertsRouter.sendAlertsTo[ruleKey.OrgID])

	// Finally, let's change the Alertmanagers choice to send only to the internal Alertmanager.
	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey.OrgID, SendAlertsTo: models.InternalAlertmanager},
	}, nil)

	// Again, make sure we sync and verify the externalAlertmanagers.
	// externalAlertmanagers should be running even though alerts are being handled externally.
	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase(context.Background()))
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 1, len(alertsRouter.externalAlertmanagersCfgHash))

	// Then, ensure the Alertmanager is still listed and the Alertmanagers choice has changed.
	assertAlertmanagersStatusForOrg(t, alertsRouter, ruleKey.OrgID, 1, 0)
	require.Equal(t, models.InternalAlertmanager, alertsRouter.sendAlertsTo[ruleKey.OrgID])

	alertsRouter.Send(context.Background(), ruleKey, alerts)

	am, err := moa.AlertmanagerFor(ruleKey.OrgID)
	require.NoError(t, err)
	actualAlerts, err := am.GetAlerts(context.Background(), true, true, true, nil, "")
	require.NoError(t, err)
	require.Len(t, actualAlerts, len(expected))
}

func TestAlertmanagersChoiceWithDisableExternalFeatureToggle(t *testing.T) {
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

	ds := datasources.DataSource{
		URL:   fakeAM.Server.URL,
		OrgID: ruleKey.OrgID,
		Type:  datasources.DS_ALERTMANAGER,
		JsonData: simplejson.NewFromAny(map[string]any{
			"handleGrafanaManagedAlerts": true,
			"implementation":             "prometheus",
		}),
	}

	var expected []*models2.PostableAlert
	alerts := definitions.PostableAlerts{}
	for i := 0; i < rand.Intn(5)+1; i++ {
		alert := generatePostableAlert(t, mockedClock)
		expected = append(expected, &alert)
		alerts.PostableAlerts = append(alerts.PostableAlerts, alert)
	}

	alertsRouter := NewAlertsRouter(moa, fakeAdminConfigStore, mockedClock, appUrl, map[int64]struct{}{},
		10*time.Minute, &fake_ds.FakeDataSourceService{DataSources: []*datasources.DataSource{&ds}},
		fake_secrets.NewFakeSecretsService(), featuremgmt.WithFeatures(featuremgmt.FlagAlertingDisableSendAlertsExternal))

	// Test that we only send to the internal Alertmanager even though the configuration specifies AllAlertmanagers.

	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey.OrgID, SendAlertsTo: models.AllAlertmanagers},
	}, nil)

	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase(context.Background()))
	require.Equal(t, 0, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 0, len(alertsRouter.externalAlertmanagersCfgHash))
	require.Equal(t, models.InternalAlertmanager, alertsRouter.sendAlertsTo[ruleKey.OrgID])

	alertsRouter.Send(context.Background(), ruleKey, alerts)

	am, err := moa.AlertmanagerFor(ruleKey.OrgID)
	require.NoError(t, err)
	actualAlerts, err := am.GetAlerts(context.Background(), true, true, true, nil, "")
	require.NoError(t, err)
	require.Len(t, actualAlerts, len(expected))

	// Test that we still only send to the internal alertmanager even though the configuration specifies ExternalAlertmanagers.

	mockedGetAdminConfigurations.Return([]*models.AdminConfiguration{
		{OrgID: ruleKey.OrgID, SendAlertsTo: models.ExternalAlertmanagers},
	}, nil)

	require.NoError(t, alertsRouter.SyncAndApplyConfigFromDatabase(context.Background()))
	require.Equal(t, 0, len(alertsRouter.externalAlertmanagers))
	require.Equal(t, 0, len(alertsRouter.externalAlertmanagersCfgHash))
	require.Equal(t, models.InternalAlertmanager, alertsRouter.sendAlertsTo[ruleKey.OrgID])

	alertsRouter.Send(context.Background(), ruleKey, alerts)

	am, err = moa.AlertmanagerFor(ruleKey.OrgID)
	require.NoError(t, err)
	actualAlerts, err = am.GetAlerts(context.Background(), true, true, true, nil, "")
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
	kvStore := fakes.NewFakeKVStore(t)
	registry := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(registry)
	secretsService := secretsManager.SetupTestService(t, fake_secrets.NewFakeSecretsStore())
	decryptFn := secretsService.GetDecryptedValue
	moa, err := notifier.NewMultiOrgAlertmanager(
		setting.ProvideService(cfg),
		cfgStore,
		orgStore,
		kvStore,
		fakes.NewFakeProvisioningStore(),
		decryptFn,
		m.GetMultiOrgAlertmanagerMetrics(),
		nil,
		fakes.NewFakeReceiverPermissionsService(),
		log.New("testlogger"),
		secretsService,
		featuremgmt.WithFeatures(),
		nil,
	)
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

func TestBuildExternalURL(t *testing.T) {
	sch := AlertsRouter{
		secretService: fake_secrets.NewFakeSecretsService(),
	}
	tests := []struct {
		name        string
		ds          *datasources.DataSource
		expectedURL string
	}{
		{
			name: "datasource without auth",
			ds: &datasources.DataSource{
				URL: "https://localhost:9000",
			},
			expectedURL: "https://localhost:9000",
		},
		{
			name: "datasource without auth and with path",
			ds: &datasources.DataSource{
				URL: "https://localhost:9000/path/to/am",
			},
			expectedURL: "https://localhost:9000/path/to/am",
		},
		{
			name: "datasource with auth",
			ds: &datasources.DataSource{
				URL:           "https://localhost:9000",
				BasicAuth:     true,
				BasicAuthUser: "johndoe",
				SecureJsonData: map[string][]byte{
					"basicAuthPassword": []byte("123"),
				},
			},
			expectedURL: "https://johndoe:123@localhost:9000",
		},
		{
			name: "datasource with auth that needs escaping",
			ds: &datasources.DataSource{
				URL:           "https://localhost:9000",
				BasicAuth:     true,
				BasicAuthUser: "johndoe",
				SecureJsonData: map[string][]byte{
					"basicAuthPassword": []byte("123#!"),
				},
			},
			expectedURL: "https://johndoe:123%23%21@localhost:9000",
		},
		{
			name: "datasource with auth and path",
			ds: &datasources.DataSource{
				URL:           "https://localhost:9000/path/to/am",
				BasicAuth:     true,
				BasicAuthUser: "johndoe",
				SecureJsonData: map[string][]byte{
					"basicAuthPassword": []byte("123"),
				},
			},
			expectedURL: "https://johndoe:123@localhost:9000/path/to/am",
		},
		{
			name: "with no scheme specified in the datasource",
			ds: &datasources.DataSource{
				URL:           "localhost:9000/path/to/am",
				BasicAuth:     true,
				BasicAuthUser: "johndoe",
				SecureJsonData: map[string][]byte{
					"basicAuthPassword": []byte("123"),
				},
			},
			expectedURL: "http://johndoe:123@localhost:9000/path/to/am",
		},
		{
			name: "with no scheme specified not auth in the datasource",
			ds: &datasources.DataSource{
				URL: "localhost:9000/path/to/am",
			},
			expectedURL: "http://localhost:9000/path/to/am",
		},
		{
			name: "adds /alertmanager to path when implementation is mimir",
			ds: &datasources.DataSource{
				URL: "https://localhost:9000",
				JsonData: func() *simplejson.Json {
					r := simplejson.New()
					r.Set("implementation", "mimir")
					return r
				}(),
			},
			expectedURL: "https://localhost:9000/alertmanager",
		},
		{
			name: "adds /alertmanager to path when implementation is cortex",
			ds: &datasources.DataSource{
				URL: "https://localhost:9000/path/to/am",
				JsonData: func() *simplejson.Json {
					r := simplejson.New()
					r.Set("implementation", "cortex")
					return r
				}(),
			},
			expectedURL: "https://localhost:9000/path/to/am/alertmanager",
		},
		{
			name: "do nothing when implementation is prometheus",
			ds: &datasources.DataSource{
				URL: "https://localhost:9000/path/to/am",
				JsonData: func() *simplejson.Json {
					r := simplejson.New()
					r.Set("implementation", "prometheus")
					return r
				}(),
			},
			expectedURL: "https://localhost:9000/path/to/am",
		},
		{
			name: "do not add /alertmanager to path when last segment already contains it",
			ds: &datasources.DataSource{
				URL: "https://localhost:9000/path/to/alertmanager",
				JsonData: func() *simplejson.Json {
					r := simplejson.New()
					r.Set("implementation", "mimir")
					return r
				}(),
			},
			expectedURL: "https://localhost:9000/path/to/alertmanager",
		},
		{
			name: "add /alertmanager to path when last segment does not exactly match",
			ds: &datasources.DataSource{
				URL: "https://localhost:9000/path/to/alertmanagerasdf",
				JsonData: func() *simplejson.Json {
					r := simplejson.New()
					r.Set("implementation", "mimir")
					return r
				}(),
			},
			expectedURL: "https://localhost:9000/path/to/alertmanagerasdf/alertmanager",
		},
		{
			name: "add /alertmanager to path when exists but is not last segment",
			ds: &datasources.DataSource{
				URL: "https://localhost:9000/alertmanager/path/to/am",
				JsonData: func() *simplejson.Json {
					r := simplejson.New()
					r.Set("implementation", "mimir")
					return r
				}(),
			},
			expectedURL: "https://localhost:9000/alertmanager/path/to/am/alertmanager",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			url, err := sch.buildExternalURL(test.ds)
			require.NoError(t, err)
			require.Equal(t, test.expectedURL, url)
		})
	}
}

func TestAlertManegers_asSHA256(t *testing.T) {
	tc := []struct {
		name       string
		amUrls     []string
		ciphertext string
	}{
		{
			name:       "asSHA256",
			amUrls:     []string{"http://localhost:9093"},
			ciphertext: "3ec9db375a5ba12f7c7b704922cf4b8e21a31e30d85be2386803829f0ee24410",
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.ciphertext, asSHA256(tt.amUrls))
		})
	}
}

func TestAlertManagers_buildRedactedAMs(t *testing.T) {
	fakeLogger := logtest.Fake{}

	tc := []struct {
		name     string
		orgId    int64
		amUrls   []string
		errCalls int
		errLog   string
		errCtx   []any
		expected []string
	}{
		{
			name:     "buildRedactedAMs",
			orgId:    1,
			amUrls:   []string{"http://user:password@localhost:9093"},
			errCalls: 0,
			errLog:   "",
			expected: []string{"http://user:xxxxx@localhost:9093"},
		},
		{
			name:     "Error building redacted AM URLs",
			orgId:    2,
			amUrls:   []string{"1234://user:password@localhost:9094"},
			errCalls: 1,
			errLog:   "Failed to parse alertmanager string",
			expected: []string{},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			var cfgs []ExternalAMcfg
			for _, url := range tt.amUrls {
				cfgs = append(cfgs, ExternalAMcfg{
					URL: url,
				})
			}

			require.Equal(t, tt.expected, buildRedactedAMs(&fakeLogger, cfgs, tt.orgId))
			require.Equal(t, tt.errCalls, fakeLogger.ErrorLogs.Calls)
			require.Equal(t, tt.errLog, fakeLogger.ErrorLogs.Message)
		})
	}
}
