package server

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/setting"
)

func TestRouterNeedsWritableStorageBackend(t *testing.T) {
	for _, tc := range []struct {
		name           string
		target         []string
		storageType    options.StorageType
		setStorageType bool
		routerEnabled  bool
		want           bool
	}{
		{
			name:          "router with default local storage",
			target:        []string{"router"},
			routerEnabled: true,
			want:          true,
		},
		{
			name:           "router with local storage",
			target:         []string{"router"},
			storageType:    options.StorageTypeUnified,
			setStorageType: true,
			routerEnabled:  true,
			want:           true,
		},
		{
			name:           "router with remote storage",
			target:         []string{"router"},
			storageType:    options.StorageTypeUnifiedGrpc,
			setStorageType: true,
			routerEnabled:  true,
			want:           false,
		},
		{
			name:           "local storage without router",
			target:         []string{"search-server"},
			storageType:    options.StorageTypeUnified,
			setStorageType: true,
			want:           false,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.Target = tc.target
			if tc.setStorageType {
				cfg.SectionWithEnvOverrides("grafana-apiserver").Key("storage_type").SetValue(string(tc.storageType))
			}

			assert.Equal(t, tc.want, routerNeedsWritableStorageBackend(cfg, tc.routerEnabled))
		})
	}
}

func TestDefaultRouterCoreURL(t *testing.T) {
	for _, tc := range []struct {
		name      string
		target    []string
		httpAddr  string
		protocol  setting.Scheme
		coreURL   string
		envURL    string
		manifests string
		want      string
	}{
		{
			name:   "router without cloud-core-apps-server",
			target: []string{"router"},
		},
		{
			name:   "cloud-core-apps-server in the process",
			target: []string{"router", "cloud-core-apps-server"},
			want:   "http://127.0.0.1:3000/cloud-core-apps-server/apps",
		},
		{
			name:     "cloud-core-apps-server on all interfaces",
			target:   []string{"router", "cloud-core-apps-server"},
			httpAddr: "0.0.0.0",
			want:     "http://127.0.0.1:3000/cloud-core-apps-server/apps",
		},
		{
			name:     "cloud-core-apps-server on a specific address",
			target:   []string{"router", "cloud-core-apps-server"},
			httpAddr: "::1",
			want:     "http://[::1]:3000/cloud-core-apps-server/apps",
		},
		{
			name:    "configured core_url",
			target:  []string{"router", "cloud-core-apps-server"},
			coreURL: "http://manifests:8080/cloud-core-apps-server/apps",
			want:    "http://manifests:8080/cloud-core-apps-server/apps",
		},
		{
			name:   "core_url set by environment variable",
			target: []string{"router", "cloud-core-apps-server"},
			envURL: "http://manifests:8080/cloud-core-apps-server/apps",
			want:   "http://manifests:8080/cloud-core-apps-server/apps",
		},
		{
			name:      "cloud-core-apps-server serving only its operator",
			target:    []string{"router", "cloud-core-apps-server"},
			manifests: "false",
		},
		{
			name:      "cloud-core-apps-server serving manifests",
			target:    []string{"router", "cloud-core-apps-server"},
			manifests: "true",
			want:      "http://127.0.0.1:3000/cloud-core-apps-server/apps",
		},
		{
			name:     "instrumentation server over HTTPS",
			target:   []string{"router", "cloud-core-apps-server"},
			protocol: setting.HTTPSScheme,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.Target = tc.target
			cfg.HTTPAddr = tc.httpAddr
			cfg.HTTPPort = "3000"
			cfg.Protocol = setting.HTTPScheme
			if tc.protocol != "" {
				cfg.Protocol = tc.protocol
			}
			if tc.coreURL != "" {
				_, err := cfg.Raw.Section("cloud_router").NewKey("core_url", tc.coreURL)
				require.NoError(t, err)
			}
			if tc.manifests != "" {
				_, err := cfg.Raw.Section("cloud_core_apps_server").NewKey("manifests", tc.manifests)
				require.NoError(t, err)
			}
			if tc.envURL != "" {
				t.Setenv("GF_CLOUD_ROUTER_CORE_URL", tc.envURL)
			}

			defaultRouterCoreURL(cfg, log.NewNopLogger())

			got := cfg.SectionWithEnvOverrides("cloud_router").Key("core_url").MustString("")
			assert.Equal(t, tc.want, got)
		})
	}
}
