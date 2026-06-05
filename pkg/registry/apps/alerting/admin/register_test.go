package admin

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// setSyncFlag installs an in-memory feature provider for
// FlagAlertingSyncExternalAlertmanager and restores the noop provider on
// cleanup. Required because the validator reads the flag via openfeature.
func setSyncFlag(t *testing.T, enabled bool) {
	t.Helper()
	err := openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagAlertingSyncExternalAlertmanager: {
			Key:      featuremgmt.FlagAlertingSyncExternalAlertmanager,
			Variants: map[string]any{"": enabled},
		},
	}))
	require.NoError(t, err)
	t.Cleanup(func() { _ = openfeature.SetProviderAndWait(openfeature.NoopProvider{}) })
}

// orgCtx returns a context with a Grafana org namespace, satisfying the
// validator's request.NamespaceInfoFrom call.
func orgCtx(orgID int64) context.Context {
	return request.WithNamespace(context.Background(), claims.OrgNamespaceFormatter(orgID))
}

func TestNewExternalSyncDatasourceValidator(t *testing.T) {
	mimirDS := &datasources.DataSource{
		UID:      "mimir-uid",
		OrgID:    1,
		Type:     datasources.DS_ALERTMANAGER,
		URL:      "http://mimir:9009",
		JsonData: simplejson.NewFromAny(map[string]any{"implementation": "mimir"}),
	}
	wrongTypeDS := &datasources.DataSource{
		UID:      "prom-uid",
		OrgID:    1,
		Type:     datasources.DS_PROMETHEUS,
		URL:      "http://prom:9090",
		JsonData: simplejson.New(),
	}
	badImplDS := &datasources.DataSource{
		UID:      "vanilla-am-uid",
		OrgID:    1,
		Type:     datasources.DS_ALERTMANAGER,
		URL:      "http://am:9093",
		JsonData: simplejson.NewFromAny(map[string]any{"implementation": "prometheus"}),
	}

	tests := []struct {
		name            string
		iniUID          string
		flagEnabled     bool
		sources         []*datasources.DataSource
		uid             string
		wantErrContains string
	}{
		{
			name:            "flag off, ini set -> sync disabled wins (flag is global enabler)",
			iniUID:          "ini-mimir-uid",
			flagEnabled:     false,
			uid:             "any-uid",
			wantErrContains: "sync is disabled on this instance",
		},
		{
			name:            "flag on, ini set -> rejected as operator-managed",
			iniUID:          "ini-mimir-uid",
			flagEnabled:     true,
			sources:         []*datasources.DataSource{mimirDS},
			uid:             "mimir-uid",
			wantErrContains: "managed by the operator",
		},
		{
			name:            "flag off, no ini override -> sync disabled",
			flagEnabled:     false,
			uid:             "any-uid",
			wantErrContains: "sync is disabled on this instance",
		},
		{
			name:            "DS not found",
			flagEnabled:     true,
			sources:         nil,
			uid:             "no-such-ds",
			wantErrContains: "datasource not found",
		},
		{
			name:            "DS wrong type",
			flagEnabled:     true,
			sources:         []*datasources.DataSource{wrongTypeDS},
			uid:             "prom-uid",
			wantErrContains: "must be of type alertmanager",
		},
		{
			name:            "DS implementation not supported",
			flagEnabled:     true,
			sources:         []*datasources.DataSource{badImplDS},
			uid:             "vanilla-am-uid",
			wantErrContains: "is not supported for sync",
		},
		{
			name:        "happy path: flag on, no ini, valid mimir DS",
			flagEnabled: true,
			sources:     []*datasources.DataSource{mimirDS},
			uid:         "mimir-uid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setSyncFlag(t, tt.flagEnabled)

			cfg := setting.NewCfg()
			cfg.UnifiedAlerting.ExternalAlertmanagerUID = tt.iniUID

			dsSvc := &dsfakes.FakeDataSourceService{DataSources: tt.sources}
			validate := newExternalSyncDatasourceValidator(cfg, dsSvc)

			err := validate(orgCtx(1), tt.uid)
			if tt.wantErrContains == "" {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			require.Contains(t, err.Error(), tt.wantErrContains)
		})
	}
}

// TestNewExternalSyncDatasourceValidator_FlagBeforeIni pins the ordering: the
// feature-flag check must fire before the ini-precedence check so the user
// learns that sync is globally disabled before being told about the operator
// override.
func TestNewExternalSyncDatasourceValidator_FlagBeforeIni(t *testing.T) {
	setSyncFlag(t, false)

	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.ExternalAlertmanagerUID = "ini-mimir-uid"

	validate := newExternalSyncDatasourceValidator(cfg, &dsfakes.FakeDataSourceService{})
	err := validate(orgCtx(1), "any-uid")
	require.Error(t, err)
	require.Contains(t, err.Error(), "sync is disabled on this instance", "feature flag must be checked before ini precedence")
}
