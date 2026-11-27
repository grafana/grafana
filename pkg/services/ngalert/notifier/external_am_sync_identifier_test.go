package notifier

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	k8svalidation "k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSyncIdentifierFromName(t *testing.T) {
	cases := map[string]string{
		"Mimir Prod":        "mimir-prod",
		"mimir_prod.eu":     "mimir-prod-eu",
		"  --Mimir  (EU)--": "mimir-eu",
		"a.-b":              "a-b",
		"Ünïcode":           "n-code",
		"!!!":               fallbackSyncIdentifier,
		"":                  fallbackSyncIdentifier,
	}
	for name, want := range cases {
		t.Run(name, func(t *testing.T) {
			got := syncIdentifierFromName(name)
			assert.Equal(t, want, got)
			assert.Empty(t, k8svalidation.IsDNS1123Subdomain(got), "must be a valid managed route name")
		})
	}
}

func TestSyncIdentifierFromName_StaysWithinTheRouteNameLimit(t *testing.T) {
	limit := legacy_storage.ManagedRouteNameMaxLength

	got := syncIdentifierFromName(strings.Repeat("a", limit+10))
	assert.Equal(t, strings.Repeat("a", limit), got)

	// Cutting the name short must not leave a trailing dash.
	got = syncIdentifierFromName(strings.Repeat("a", limit-1) + " bbb")
	assert.Equal(t, strings.Repeat("a", limit-1), got)
}

func TestBuildSyncStatus_KeepsIdentifierRecordedForTheSameDatasource(t *testing.T) {
	prev := withSyncIdentifier(nil, "ds-1", originAPI, "mimir-prod")

	st := computeSyncStatus(&prev, "ds-1", originAPI, nil, time.Now())
	assert.Equal(t, "mimir-prod", recordedSyncIdentifier(&st, "ds-1"))

	st = computeSyncStatus(&prev, "ds-2", originAPI, nil, time.Now())
	assert.Empty(t, recordedSyncIdentifier(&st, "ds-2"), "an identifier recorded for another datasource must not carry over")
}

func namedMimirDS(uid, name string, orgID int64) *datasources.DataSource {
	ds := makeMimirDS(uid, orgID)
	ds.Name = name
	return ds
}

func TestSyncExternalAMs_ImportsUnderNameFromDatasource(t *testing.T) {
	proxy := singleAMProxy(t, "p8e80f9aef21f6940", "route:\n  receiver: mimir-default\nreceivers:\n  - name: mimir-default")
	ds := namedMimirDS("p8e80f9aef21f6940", "Mimir Prod", 1)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "p8e80f9aef21f6940")

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1}, proxy)
	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	saved, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 1)
	require.NoError(t, err)
	cfg, err := Load([]byte(saved.AlertmanagerConfiguration))
	require.NoError(t, err)
	require.Len(t, cfg.ExtraConfigs, 1)
	assert.Equal(t, "mimir-prod", cfg.ExtraConfigs[0].Identifier)

	obj, err := adminCfg.lookup("org-1")
	require.NoError(t, err)
	assert.Equal(t, "mimir-prod", recordedSyncIdentifier(&obj.Status, "p8e80f9aef21f6940"))
}

func TestSyncExternalAMs_KeepsNameAfterDatasourceRename(t *testing.T) {
	proxy := singleAMProxy(t, "ds-1", "route:\n  receiver: first\nreceivers:\n  - name: first")
	ds := namedMimirDS("ds-1", "Mimir Prod", 1)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "ds-1")

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1}, proxy)
	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	ds.Name = "Mimir Renamed"
	// A changed upstream config so the second tick saves instead of skipping as unchanged.
	proxy.setResponse("ds-1", http.StatusOK, mimirConfigBody(t, "route:\n  receiver: second\nreceivers:\n  - name: second"))
	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	saved, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 1)
	require.NoError(t, err)
	cfg, err := Load([]byte(saved.AlertmanagerConfiguration))
	require.NoError(t, err)
	require.Len(t, cfg.ExtraConfigs, 1)
	assert.Equal(t, "mimir-prod", cfg.ExtraConfigs[0].Identifier)
	// Both ticks fetched, and the second save didn't clash with the first import.
	assert.Equal(t, float64(2), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues("1")))
	assert.Zero(t, testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", ReasonIdentifierMismatch.Label())))
	assert.Zero(t, testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", ReasonSave.Label())))
}

func TestSyncExternalAMs_FailsTheTickWhenTheNameCannotBeRecorded(t *testing.T) {
	proxy := singleAMProxy(t, "ds-1", "route:\n  receiver: mimir-default\nreceivers:\n  - name: mimir-default")
	ds := namedMimirDS("ds-1", "Mimir Prod", 1)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "ds-1")
	adminCfg.setWriteErr(1, fmt.Errorf("storage unavailable"))

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1}, proxy)
	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	assertNoExtraConfigSaved(t, cs, 1)
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", ReasonConfigRead.Label())))
}

// newIdentifierTestSyncer builds a syncer wired only with what ensureSyncIdentifier needs.
func newIdentifierTestSyncer(t *testing.T, adminCfg *fakeConfigClient, reader amConfigReader, ds ...*datasources.DataSource) *ExternalAMSyncer {
	t.Helper()
	return NewExternalAMSyncer(&dsfakes.FakeDataSourceService{DataSources: ds}, nil, &setting.Cfg{}, nil, log.NewNopLogger(), adminCfg, adminCfg.nsMapper, reader)
}

func TestEnsureSyncIdentifier(t *testing.T) {
	ctx := context.Background()

	t.Run("keeps the UID for a config imported before identifiers were recorded", func(t *testing.T) {
		adminCfg := newFakeConfigClient()
		adminCfg.setUID(1, "ds-1")
		s := newIdentifierTestSyncer(t, adminCfg, fakeAMConfigReader{raw: configWithManagedRoute("ds-1")}, namedMimirDS("ds-1", "Mimir Prod", 1))

		got, err := s.ensureSyncIdentifier(ctx, 1, syncTarget{uid: "ds-1", origin: originAPI})
		require.NoError(t, err)
		assert.Equal(t, "ds-1", got)
	})

	t.Run("fails when a policy tree has the name", func(t *testing.T) {
		adminCfg := newFakeConfigClient()
		adminCfg.setUID(1, "ds-1")
		s := newIdentifierTestSyncer(t, adminCfg, fakeAMConfigReader{raw: configWithManagedRoute("mimir-prod")}, namedMimirDS("ds-1", "Mimir Prod", 1))

		_, err := s.ensureSyncIdentifier(ctx, 1, syncTarget{uid: "ds-1", origin: originAPI})
		require.Error(t, err)
		assert.Equal(t, ReasonIdentifierTaken, reasonOf(err))
		obj, lookupErr := adminCfg.lookup("org-1")
		require.NoError(t, lookupErr)
		assert.Empty(t, recordedSyncIdentifier(&obj.Status, "ds-1"), "nothing is recorded")
	})

	t.Run("fails for the names reserved for the default routing tree", func(t *testing.T) {
		for _, name := range []string{"Default", "User Defined"} {
			adminCfg := newFakeConfigClient()
			adminCfg.setUID(1, "ds-1")
			s := newIdentifierTestSyncer(t, adminCfg, fakeAMConfigReader{raw: validAMConfigBase}, namedMimirDS("ds-1", name, 1))

			_, err := s.ensureSyncIdentifier(ctx, 1, syncTarget{uid: "ds-1", origin: originAPI})
			require.Error(t, err, name)
			assert.Equal(t, ReasonIdentifierTaken, reasonOf(err), name)
		}
	})

	t.Run("records the same name again for an import staged under it", func(t *testing.T) {
		adminCfg := newFakeConfigClient()
		adminCfg.setUID(1, "ds-1")
		s := newIdentifierTestSyncer(t, adminCfg, fakeAMConfigReader{raw: configWithExtraConfig("mimir-prod", v1.ExtraConfigManagedByAutoSync)}, namedMimirDS("ds-1", "Mimir Prod", 1))

		got, err := s.ensureSyncIdentifier(ctx, 1, syncTarget{uid: "ds-1", origin: originAPI})
		require.NoError(t, err)
		assert.Equal(t, "mimir-prod", got)
	})

	t.Run("keeps the UID for an import staged under it before identifiers were recorded", func(t *testing.T) {
		adminCfg := newFakeConfigClient()
		adminCfg.setUID(1, "ds-1")
		// There is no policy tree under the UID. Only the staged import marks it as used.
		s := newIdentifierTestSyncer(t, adminCfg, fakeAMConfigReader{raw: configWithExtraConfig("ds-1", "")}, namedMimirDS("ds-1", "Mimir Prod", 1))

		got, err := s.ensureSyncIdentifier(ctx, 1, syncTarget{uid: "ds-1", origin: originAPI})
		require.NoError(t, err)
		assert.Equal(t, "ds-1", got)

		obj, err := adminCfg.lookup("org-1")
		require.NoError(t, err)
		assert.Equal(t, "ds-1", recordedSyncIdentifier(&obj.Status, "ds-1"))
	})

	t.Run("names the sync after the datasource even when a manual import has that name", func(t *testing.T) {
		adminCfg := newFakeConfigClient()
		adminCfg.setUID(1, "ds-1")
		raw := configWithExtraConfig("prod", v1.ExtraConfigManagedByManual)
		s := newIdentifierTestSyncer(t, adminCfg, fakeAMConfigReader{raw: raw}, namedMimirDS("ds-1", "Prod", 1))

		// The save is refused later as foreign_owner, so the manual import is never overwritten.
		got, err := s.ensureSyncIdentifier(ctx, 1, syncTarget{uid: "ds-1", origin: originAPI})
		require.NoError(t, err)
		assert.Equal(t, "prod", got)
	})

	t.Run("does not take over a staged import under an unrelated name", func(t *testing.T) {
		adminCfg := newFakeConfigClient()
		adminCfg.setUID(1, "ds-1")
		s := newIdentifierTestSyncer(t, adminCfg, fakeAMConfigReader{raw: configWithExtraConfig("someone-elses", v1.ExtraConfigManagedByAutoSync)}, namedMimirDS("ds-1", "Mimir Prod", 1))

		got, err := s.ensureSyncIdentifier(ctx, 1, syncTarget{uid: "ds-1", origin: originAPI})
		require.NoError(t, err)
		assert.Equal(t, "mimir-prod", got)
	})

	t.Run("fails when the name cannot be recorded", func(t *testing.T) {
		adminCfg := newFakeConfigClient()
		adminCfg.setUID(1, "ds-1")
		adminCfg.setWriteErr(1, fmt.Errorf("storage unavailable"))
		s := newIdentifierTestSyncer(t, adminCfg, fakeAMConfigReader{raw: validAMConfigBase}, namedMimirDS("ds-1", "Mimir Prod", 1))

		_, err := s.ensureSyncIdentifier(ctx, 1, syncTarget{uid: "ds-1", origin: originAPI})
		require.Error(t, err)
		assert.Equal(t, ReasonConfigRead, reasonOf(err))
	})

	t.Run("uses a name another instance recorded first", func(t *testing.T) {
		adminCfg := newFakeConfigClient()
		adminCfg.setUID(1, "ds-1")
		obj, err := adminCfg.lookup("org-1")
		require.NoError(t, err)
		obj.Status = withSyncIdentifier(nil, "ds-1", originAPI, "picked-elsewhere")
		s := newIdentifierTestSyncer(t, adminCfg, fakeAMConfigReader{raw: validAMConfigBase}, namedMimirDS("ds-1", "Mimir Prod", 1))

		// The caller read the status before the other instance wrote it, so it has no identifier yet.
		got, err := s.ensureSyncIdentifier(ctx, 1, syncTarget{uid: "ds-1", origin: originAPI})
		require.NoError(t, err)
		assert.Equal(t, "picked-elsewhere", got)
	})

	t.Run("returns a recorded identifier without reading anything", func(t *testing.T) {
		s := &ExternalAMSyncer{configReader: fakeAMConfigReader{err: fmt.Errorf("must not be read")}}

		got, err := s.ensureSyncIdentifier(ctx, 1, syncTarget{uid: "ds-1", identifier: "mimir-prod"})
		require.NoError(t, err)
		assert.Equal(t, "mimir-prod", got)
	})

	t.Run("a config read failure skips the tick", func(t *testing.T) {
		s := &ExternalAMSyncer{configReader: fakeAMConfigReader{err: fmt.Errorf("db down")}}

		_, err := s.ensureSyncIdentifier(ctx, 1, syncTarget{uid: "ds-1"})
		require.Error(t, err)
		assert.Equal(t, ReasonConfigRead, reasonOf(err))
	})
}

func TestResolveSyncTarget_IniOverrideWorksWithoutTheConfigResource(t *testing.T) {
	adminCfg := newFakeConfigClient()
	adminCfg.setErr(1, fmt.Errorf("apiserver unavailable"))
	settings := &setting.Cfg{UnifiedAlerting: setting.UnifiedAlertingSettings{ExternalAlertmanagerUID: "operator-uid"}}
	s := NewExternalAMSyncer(&dsfakes.FakeDataSourceService{}, nil, settings, nil, log.NewNopLogger(), adminCfg, adminCfg.nsMapper, nil)

	target, err := s.resolveSyncTarget(context.Background(), 1)
	require.NoError(t, err)
	assert.Equal(t, syncTarget{uid: "operator-uid", origin: originIni, identifierUnknown: true}, target)
	assert.Equal(t, "operator-uid", target.identifierOrUID())
}

func TestSyncExternalAMs_ImportUnderRecordedNameIsMarkedAutoSync(t *testing.T) {
	proxy := singleAMProxy(t, "ds-1", "route:\n  receiver: mimir-default\nreceivers:\n  - name: mimir-default")
	ds := namedMimirDS("ds-1", "Mimir Prod", 1)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "ds-1")

	moa, _ := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1}, proxy)
	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	gettable, err := moa.GetAlertmanagerConfiguration(context.Background(), 1, false)
	require.NoError(t, err)
	require.Len(t, gettable.ExtraConfigs, 1)
	assert.Equal(t, "mimir-prod", gettable.ExtraConfigs[0].Identifier)
	assert.Equal(t, "auto-sync", gettable.ExtraConfigs[0].ManagedBy)
}

func TestDeleteExtraConfiguration_NameBasedSyncImport(t *testing.T) {
	ctx := context.Background()
	signedIn := &user.SignedInUser{}

	setup := func(t *testing.T) (*MultiOrgAlertmanager, *fakeConfigClient) {
		proxy := singleAMProxy(t, "ds-1", "route:\n  receiver: mimir-default\nreceivers:\n  - name: mimir-default")
		dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{namedMimirDS("ds-1", "Mimir Prod", 1)}}
		adminCfg := newFakeConfigClient()
		adminCfg.setUID(1, "ds-1")
		moa, _ := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1}, proxy)
		moa.SyncAlertmanagersForOrgs(ctx, []int64{1})

		gettable, err := moa.GetAlertmanagerConfiguration(ctx, 1, false)
		require.NoError(t, err)
		require.Len(t, gettable.ExtraConfigs, 1)
		require.Equal(t, "mimir-prod", gettable.ExtraConfigs[0].Identifier)
		return moa, adminCfg
	}

	t.Run("is refused while sync is active", func(t *testing.T) {
		moa, _ := setup(t)

		err := moa.DeleteExtraConfiguration(ctx, 1, signedIn, noopExtraConfigAuthz{}, "mimir-prod")
		require.ErrorIs(t, err, ErrAlertmanagerExtraConfigManagedByAutoSync)

		gettable, err := moa.GetAlertmanagerConfiguration(ctx, 1, false)
		require.NoError(t, err)
		require.Len(t, gettable.ExtraConfigs, 1, "the config must still be staged")
	})

	t.Run("is allowed for the stale slot once sync points at another datasource", func(t *testing.T) {
		moa, adminCfg := setup(t)
		// Pointing the sync at another data source drops the identifier recorded for ds-1.
		adminCfg.setUID(1, "ds-2")

		gettable, err := moa.GetAlertmanagerConfiguration(ctx, 1, false)
		require.NoError(t, err)
		require.Equal(t, "manual", gettable.ExtraConfigs[0].ManagedBy)

		require.NoError(t, moa.DeleteExtraConfiguration(ctx, 1, signedIn, noopExtraConfigAuthz{}, "mimir-prod"))
		gettable, err = moa.GetAlertmanagerConfiguration(ctx, 1, false)
		require.NoError(t, err)
		require.Empty(t, gettable.ExtraConfigs)
	})
}

func TestSyncExternalAMs_RecordedIdentifierUnavailable(t *testing.T) {
	ctx := context.Background()
	signedIn := &user.SignedInUser{}
	const syncedConfig = "route:\n  receiver: first\nreceivers:\n  - name: first"

	// The ini override still gives the data source while the Config, which holds the recorded
	// identifier, cannot be read.
	setup := func(t *testing.T) (*MultiOrgAlertmanager, *fakeConfigClient, *datasources.DataSource, *fakeDatasourceProxy) {
		proxy := singleAMProxy(t, "ds-1", syncedConfig)
		ds := namedMimirDS("ds-1", "Mimir Prod", 1)
		dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}
		adminCfg := newFakeConfigClient()
		adminCfg.setUID(1, "ds-1")
		moa, _ := buildSyncTestMOA(t, adminCfg, dsSvc, true, "ds-1", []int64{1}, proxy)
		return moa, adminCfg, ds, proxy
	}
	stagedIdentifiers := func(t *testing.T, moa *MultiOrgAlertmanager) []string {
		gettable, err := moa.GetAlertmanagerConfiguration(ctx, 1, false)
		require.NoError(t, err)
		ids := make([]string, 0, len(gettable.ExtraConfigs))
		for _, ec := range gettable.ExtraConfigs {
			ids = append(ids, ec.Identifier)
		}
		return ids
	}

	t.Run("deleting a name-based sync import is refused", func(t *testing.T) {
		moa, adminCfg, _, _ := setup(t)
		moa.SyncAlertmanagersForOrgs(ctx, []int64{1})
		require.Equal(t, []string{"mimir-prod"}, stagedIdentifiers(t, moa))

		adminCfg.setErr(1, fmt.Errorf("storage unavailable"))
		err := moa.DeleteExtraConfiguration(ctx, 1, signedIn, noopExtraConfigAuthz{}, "mimir-prod")
		require.ErrorContains(t, err, "resolve external alertmanager sync identifier")
		adminCfg.setErr(1, nil)
		require.Equal(t, []string{"mimir-prod"}, stagedIdentifiers(t, moa))
	})

	t.Run("deleting a manual import still works", func(t *testing.T) {
		moa, adminCfg, _, _ := setup(t)
		manual := v1.ExtraConfiguration{Identifier: "manual-import", AlertmanagerConfig: "route:\n  receiver: m\nreceivers:\n  - name: m"}
		_, err := moa.SaveAndApplyExtraConfiguration(ctx, 1, signedIn, noopExtraConfigAuthz{}, manual, false, false, false)
		require.NoError(t, err)

		adminCfg.setErr(1, fmt.Errorf("storage unavailable"))
		require.NoError(t, moa.DeleteExtraConfiguration(ctx, 1, signedIn, noopExtraConfigAuthz{}, "manual-import"))
	})

	t.Run("sync keeps its name through the outage and recovers after it", func(t *testing.T) {
		moa, adminCfg, ds, proxy := setup(t)
		moa.SyncAlertmanagersForOrgs(ctx, []int64{1})
		require.Equal(t, []string{"mimir-prod"}, stagedIdentifiers(t, moa))

		// A rename during the outage would otherwise lead to a second name.
		ds.Name = "Mimir Renamed"
		proxy.setResponse("ds-1", http.StatusOK, mimirConfigBody(t, "route:\n  receiver: second\nreceivers:\n  - name: second"))
		adminCfg.setErr(1, fmt.Errorf("storage unavailable"))
		moa.SyncAlertmanagersForOrgs(ctx, []int64{1})

		assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", ReasonConfigRead.Label())))
		assert.Equal(t, []string{"mimir-prod"}, stagedIdentifiers(t, moa))

		adminCfg.setErr(1, nil)
		obj, err := adminCfg.lookup("org-1")
		require.NoError(t, err)
		assert.Equal(t, "mimir-prod", recordedSyncIdentifier(&obj.Status, "ds-1"), "the recorded name is untouched")
		moa.SyncAlertmanagersForOrgs(ctx, []int64{1})

		assert.Equal(t, []string{"mimir-prod"}, stagedIdentifiers(t, moa))
		assert.Zero(t, testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", ReasonIdentifierMismatch.Label())))
		gettable, err := moa.GetAlertmanagerConfiguration(ctx, 1, false)
		require.NoError(t, err)
		assert.Contains(t, gettable.ExtraConfigs[0].AlertmanagerConfig, "second", "the sync resumed saving under the recorded name")
		assert.Equal(t, "auto-sync", gettable.ExtraConfigs[0].ManagedBy)
	})
}

func TestEnsureSyncIdentifier_ChoosesNothingWhileTheRecordedIdentifierIsUnavailable(t *testing.T) {
	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "ds-1")
	s := newIdentifierTestSyncer(t, adminCfg, fakeAMConfigReader{raw: validAMConfigBase}, namedMimirDS("ds-1", "Mimir Prod", 1))

	_, err := s.ensureSyncIdentifier(context.Background(), 1, syncTarget{uid: "ds-1", origin: originIni, identifierUnknown: true})
	require.Error(t, err)
	assert.Equal(t, ReasonConfigRead, reasonOf(err))
	obj, lookupErr := adminCfg.lookup("org-1")
	require.NoError(t, lookupErr)
	assert.Empty(t, recordedSyncIdentifier(&obj.Status, "ds-1"), "nothing is recorded")
}

// A sync that started before names were used has an import under the UID and no owner. The sync
// treats an import without an owner as manual, so every save is refused until it is deleted. It is
// then recreated under the UID. This test pins that, so a change to it is deliberate.
func TestSyncExternalAMs_LegacyUIDImportWithoutOwnerIsRefusedUntilDeleted(t *testing.T) {
	ctx := context.Background()
	proxy := singleAMProxy(t, "ds-1", "route:\n  receiver: first\nreceivers:\n  - name: first")
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{namedMimirDS("ds-1", "Mimir Prod", 1)}}
	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "ds-1")
	moa, _ := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1}, proxy)

	legacy := v1.ExtraConfiguration{Identifier: "ds-1", AlertmanagerConfig: "route:\n  receiver: old\nreceivers:\n  - name: old"}
	_, err := moa.SaveAndApplyExtraConfiguration(ctx, 1, &user.SignedInUser{}, noopExtraConfigAuthz{}, legacy, false, false, false)
	require.NoError(t, err)

	moa.SyncAlertmanagersForOrgs(ctx, []int64{1})

	obj, err := adminCfg.lookup("org-1")
	require.NoError(t, err)
	assert.Equal(t, "ds-1", recordedSyncIdentifier(&obj.Status, "ds-1"), "the UID is recorded, not the datasource name")
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", ReasonForeignOwner.Label())))
	gettable, err := moa.GetAlertmanagerConfiguration(ctx, 1, false)
	require.NoError(t, err)
	require.Len(t, gettable.ExtraConfigs, 1)
	assert.Equal(t, "manual", gettable.ExtraConfigs[0].ManagedBy)
	assert.Contains(t, gettable.ExtraConfigs[0].AlertmanagerConfig, "old", "the legacy import is left alone")

	require.NoError(t, moa.DeleteExtraConfiguration(ctx, 1, &user.SignedInUser{}, noopExtraConfigAuthz{}, "ds-1"))
	proxy.setResponse("ds-1", http.StatusOK, mimirConfigBody(t, "route:\n  receiver: second\nreceivers:\n  - name: second"))
	moa.SyncAlertmanagersForOrgs(ctx, []int64{1})

	gettable, err = moa.GetAlertmanagerConfiguration(ctx, 1, false)
	require.NoError(t, err)
	require.Len(t, gettable.ExtraConfigs, 1)
	assert.Equal(t, "ds-1", gettable.ExtraConfigs[0].Identifier, "recreated under the UID, not the name")
	assert.Equal(t, "auto-sync", gettable.ExtraConfigs[0].ManagedBy)
}

const extraConfigYAML = `route:\n  receiver: a\nreceivers:\n  - name: a`

// configWithExtraConfig returns an AM config with an import staged under identifier and owned by
// managedBy. An empty managedBy stands for an import that predates owners.
func configWithExtraConfig(identifier, managedBy string) string {
	return validAMConfigBase[:len(validAMConfigBase)-1] + fmt.Sprintf(`,"extra_config":[{"identifier":%q,"alertmanager_config":%q,"managed_by":%q}]}`, identifier, extraConfigYAML, managedBy)
}
