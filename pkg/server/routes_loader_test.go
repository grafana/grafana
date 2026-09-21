package server

import (
	"testing"

	"github.com/stretchr/testify/assert"

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
