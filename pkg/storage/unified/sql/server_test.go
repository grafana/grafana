package sql

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
	"github.com/stretchr/testify/require"
)

func TestBuildResourceServerOptionsGRPCErrorResultToStatus(t *testing.T) {
	cfg := setting.NewCfg()
	for _, enabled := range []bool{false, true} {
		cfg.UnifiedStorageGRPCErrorResultToStatus = enabled
		opts, err := buildResourceServerOptions(&ServerOptions{Cfg: cfg})
		require.NoError(t, err)
		require.Equal(t, enabled, opts.GRPCErrorResultToStatus)
	}
}

func TestIsHighAvailabilityEnabled(t *testing.T) {
	tests := []struct {
		name string
		cfg  *setting.Cfg
		isHA bool
	}{
		{
			name: "SQLite should never have HA enabled",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.SQLite)
				dbSection.Key("high_availability").SetValue("true")
				return cfg
			}(),
			isHA: false,
		},
		{
			name: "MySQL with HA enabled in config should default to true",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.MySQL)
				dbSection.Key("high_availability").SetValue("true")
				return cfg
			}(),
			isHA: true,
		},
		{
			name: "MySQL with HA disabled in config should default to false",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.MySQL)
				dbSection.Key("high_availability").SetValue("false")
				return cfg
			}(),
			isHA: false,
		},
		{
			name: "MySQL with no HA config should default to true",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.MySQL)
				return cfg
			}(),
			isHA: true,
		},
		{
			name: "Postgres with HA enabled in config should default to true",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.Postgres)
				dbSection.Key("high_availability").SetValue("true")
				return cfg
			}(),
			isHA: true,
		},
		{
			name: "Postgres with HA disabled in config should default to false",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.Postgres)
				dbSection.Key("high_availability").SetValue("false")
				return cfg
			}(),
			isHA: false,
		},
		{
			name: "Postgres with no HA config should default to true",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.Postgres)
				return cfg
			}(),
			isHA: true,
		},
		{
			name: "No database type set should default to true",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				_ = cfg.SectionWithEnvOverrides("database")
				return cfg
			}(),
			isHA: true,
		},
		{
			name: "No database type set with HA enabled in config should default to true",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("high_availability").SetValue("true")
				return cfg
			}(),
			isHA: true,
		},
		{
			name: "No database type set with HA disabled in config should default to false",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("high_availability").SetValue("false")
				return cfg
			}(),
			isHA: false,
		},
		{
			name: "Resource API with non-SQLite database type should default to true",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.SQLite)
				resourceAPISection := cfg.SectionWithEnvOverrides("resource_api")
				resourceAPISection.Key("db_type").SetValue(migrator.Postgres)
				return cfg
			}(),
			isHA: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isHighAvailabilityEnabled(tt.cfg.SectionWithEnvOverrides("database"),
				tt.cfg.SectionWithEnvOverrides("resource_api"))
			require.Equal(t, tt.isHA, result)
		})
	}
}

func TestWithAccessClientValidatesAuthzConfig(t *testing.T) {
	tests := []struct {
		name       string
		enabled    bool
		exemptions []string
		wantError  string
	}{
		{name: "disabled with empty exemptions is valid"},
		{name: "enabled with empty exemptions is valid", enabled: true},
		{name: "enabled with exact exemption is valid", enabled: true, exemptions: []string{"example.grafana.app/widgets"}},
		{name: "malformed exemption fails initialization while disabled", exemptions: []string{"invalid"}, wantError: "invalid unified storage authz exemption"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.UnifiedStorageAuthzExemptionEnabled = tt.enabled
			cfg.UnifiedStorageAuthzExemptResources = tt.exemptions
			err := withAccessClient(&ServerOptions{
				Cfg:          cfg,
				AccessClient: types.FixedAccessClient(true),
			}, &resource.ResourceServerOptions{})
			if tt.wantError != "" {
				require.ErrorContains(t, err, tt.wantError)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestWithAuthorizeBeforeFetch(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.AuthorizeBeforeFetchEnabled = true
	resourceOpts := &resource.ResourceServerOptions{}
	require.NoError(t, withAuthorizeBeforeFetch(&ServerOptions{Cfg: cfg}, resourceOpts))
	require.True(t, resourceOpts.AuthorizeBeforeFetchEnabled)
}

func TestWithNatsWatchMaxAge(t *testing.T) {
	const maxAge = 5 * time.Minute

	tests := []struct {
		name     string
		enabled  bool
		notifier bool
		maxAge   time.Duration
		want     time.Duration
	}{
		{name: "nats disabled leaves it off", notifier: true, maxAge: maxAge, want: 0},
		{name: "notifier off leaves it off", enabled: true, maxAge: maxAge, want: 0},
		{name: "enabled and notifier on propagates the age", enabled: true, notifier: true, maxAge: maxAge, want: maxAge},
		{name: "zero leaves expiry off", enabled: true, notifier: true, maxAge: 0, want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.NATS.Enabled = tt.enabled
			cfg.NATS.Notifier = tt.notifier
			cfg.NATS.NotifierWatchMaxAge = tt.maxAge

			resourceOpts := &resource.ResourceServerOptions{}
			require.NoError(t, withNatsWatchMaxAge(&ServerOptions{Cfg: cfg}, resourceOpts))
			require.Equal(t, tt.want, resourceOpts.NatsWatchMaxAge)
		})
	}
}

// fakeKVBackedDashboardStats simulates OssDashboardStats with a non-nil KV
// delegate: it implements the optional RefreshesFromKV capability and always
// reports true.
type fakeKVBackedDashboardStats struct{}

func (fakeKVBackedDashboardStats) GetStats(context.Context, string) (map[string]map[string]int64, error) {
	return nil, nil
}

func (fakeKVBackedDashboardStats) GetDashboardStats(context.Context, string, string) (map[string]int64, error) {
	return nil, nil
}

func (fakeKVBackedDashboardStats) RefreshesFromKV() bool { return true }

// fakeExplicitNonKVDashboardStats implements RefreshesFromKV but reports
// false, e.g. an OssDashboardStats whose KV delegate is nil.
type fakeExplicitNonKVDashboardStats struct{}

func (fakeExplicitNonKVDashboardStats) GetStats(context.Context, string) (map[string]map[string]int64, error) {
	return nil, nil
}

func (fakeExplicitNonKVDashboardStats) GetDashboardStats(context.Context, string, string) (map[string]int64, error) {
	return nil, nil
}

func (fakeExplicitNonKVDashboardStats) RefreshesFromKV() bool { return false }

// fakeHTTPDashboardStats simulates Enterprise's usageinsights HTTP-backed
// DashboardStats: it implements only builders.DashboardStats, with no notion
// of a KV refresh loop, so it does not implement RefreshesFromKV at all.
type fakeHTTPDashboardStats struct{}

func (fakeHTTPDashboardStats) GetStats(context.Context, string) (map[string]map[string]int64, error) {
	return nil, nil
}

func (fakeHTTPDashboardStats) GetDashboardStats(context.Context, string, string) (map[string]int64, error) {
	return nil, nil
}

// TestWithSearchKVStatsRefreshInterval verifies the generic (any-kind) KV
// stats builder refresh loop: enabled whenever a KVStore is present,
// independent of DashboardStats or its optional RefreshesFromKV capability
// (opts.KVStore != nil). Deciding whether dashboards specifically benefit
// from a scan is now search.go's job, per pinned builder
// (resource.KVFieldSnapshotter): DashboardDocumentBuilder.KVFieldSnapshot()
// still returns ok=false for Enterprise's legacy (non-KV) DashboardStats,
// so dashboards see no change in behaviour there -- but the interval this
// function computes is no longer gated on DashboardStats at all, since a
// KV-sourced kind's builder (e.g. playlists) is never a DashboardStats and
// must still get the refresh loop it needs.
func TestWithSearchKVStatsRefreshInterval(t *testing.T) {
	tests := []struct {
		name           string
		kvStore        *kv.ResourceKVStore
		dashboardStats builders.DashboardStats
		cfgInterval    time.Duration
		want           time.Duration
	}{
		{
			name:           "no KV store: interval stays 0 even if DashboardStats would refresh",
			kvStore:        nil,
			dashboardStats: fakeKVBackedDashboardStats{},
			want:           0,
		},
		{
			name:           "KV store present but DashboardStats is nil: default interval applied (gate is KVStore alone)",
			kvStore:        &kv.ResourceKVStore{},
			dashboardStats: nil,
			want:           5 * time.Minute,
		},
		{
			name:           "KV store present, non-KV DashboardStats (Enterprise-style, no capability): default interval applied",
			kvStore:        &kv.ResourceKVStore{},
			dashboardStats: fakeHTTPDashboardStats{},
			want:           5 * time.Minute,
		},
		{
			name:           "KV store present, DashboardStats explicitly reports RefreshesFromKV=false: default interval applied",
			kvStore:        &kv.ResourceKVStore{},
			dashboardStats: fakeExplicitNonKVDashboardStats{},
			want:           5 * time.Minute,
		},
		{
			name:           "KV store present, DashboardStats reports RefreshesFromKV=true: default interval applied",
			kvStore:        &kv.ResourceKVStore{},
			dashboardStats: fakeKVBackedDashboardStats{},
			want:           5 * time.Minute,
		},
		{
			name:           "KV store present, RefreshesFromKV=true, configured interval overrides the default",
			kvStore:        &kv.ResourceKVStore{},
			dashboardStats: fakeKVBackedDashboardStats{},
			cfgInterval:    5 * time.Second,
			want:           5 * time.Second,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.KVStatsRefreshInterval = tt.cfgInterval

			resourceOpts := &resource.ResourceServerOptions{}
			opts := &ServerOptions{
				Cfg:            cfg,
				KVStore:        tt.kvStore,
				DashboardStats: tt.dashboardStats,
			}
			require.NoError(t, withSearch(opts, resourceOpts))
			require.Equal(t, tt.want, resourceOpts.Search.KVStatsRefreshInterval)
		})
	}
}

func TestWithBackendSharesWatchExpiry(t *testing.T) {
	expiry := resource.NewWatchExpiry()
	resourceOpts := &resource.ResourceServerOptions{}
	require.NoError(t, withBackend(&ServerOptions{
		Backend: &resource.UnimplementedStorageBackend{}, WatchExpiry: expiry,
	}, resourceOpts))
	require.Same(t, expiry, resourceOpts.WatchExpiry)
}
