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

func TestUniqueSyncIdentifier(t *testing.T) {
	taken := func(names ...string) map[string]struct{} {
		m := map[string]struct{}{}
		for _, n := range names {
			m[n] = struct{}{}
		}
		return m
	}

	assert.Equal(t, "mimir", uniqueSyncIdentifier("mimir", taken()))
	assert.Equal(t, "mimir-2", uniqueSyncIdentifier("mimir", taken("mimir")))
	assert.Equal(t, "mimir-3", uniqueSyncIdentifier("mimir", taken("mimir", "mimir-2")))

	long := strings.Repeat("a", 50)
	assert.Equal(t, strings.Repeat("a", 40), uniqueSyncIdentifier(long, taken()))
	assert.Equal(t, strings.Repeat("a", 38)+"-2", uniqueSyncIdentifier(long, taken(strings.Repeat("a", 40))))
	// Cutting the name short must not leave a dash right before the suffix.
	assert.Equal(t, strings.Repeat("a", 37)+"-2", uniqueSyncIdentifier(strings.Repeat("a", 37)+"-bbb", taken(strings.Repeat("a", 37)+"-bb")))
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

func TestSyncExternalAMs_FallsBackToUIDWhenTheNameCannotBeRecorded(t *testing.T) {
	proxy := singleAMProxy(t, "ds-1", "route:\n  receiver: mimir-default\nreceivers:\n  - name: mimir-default")
	ds := namedMimirDS("ds-1", "Mimir Prod", 1)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "ds-1")
	adminCfg.setWriteErr(1, fmt.Errorf("storage unavailable"))

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1}, proxy)
	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	saved, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 1)
	require.NoError(t, err)
	cfg, err := Load([]byte(saved.AlertmanagerConfiguration))
	require.NoError(t, err)
	require.Len(t, cfg.ExtraConfigs, 1)
	assert.Equal(t, "ds-1", cfg.ExtraConfigs[0].Identifier)
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

	t.Run("adds a suffix when a policy tree already has the name", func(t *testing.T) {
		adminCfg := newFakeConfigClient()
		adminCfg.setUID(1, "ds-1")
		s := newIdentifierTestSyncer(t, adminCfg, fakeAMConfigReader{raw: configWithManagedRoute("mimir-prod")}, namedMimirDS("ds-1", "Mimir Prod", 1))

		got, err := s.ensureSyncIdentifier(ctx, 1, syncTarget{uid: "ds-1", origin: originAPI})
		require.NoError(t, err)
		assert.Equal(t, "mimir-prod-2", got)
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
	assert.Equal(t, syncTarget{uid: "operator-uid", origin: originIni}, target)
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
