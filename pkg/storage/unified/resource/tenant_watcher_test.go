package resource

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestNewTenantWatcherConfig(t *testing.T) {
	newCfg := func() *setting.Cfg {
		cfg := setting.NewCfg()
		cfg.TenantApiServerAddress = "https://example.com/tenant-api"
		cfg.TenantWatcherAllowInsecureTLS = true

		grpcSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")
		grpcSection.Key("token").SetValue("token")
		grpcSection.Key("token_exchange_url").SetValue("https://example.com/token-exchange")

		return cfg
	}

	t.Run("returns config when all settings are present", func(t *testing.T) {
		cfg := newCfg()
		tenantWatcherCfg := NewTenantWatcherConfig(cfg)
		require.NotNil(t, tenantWatcherCfg)
		require.Equal(t, "https://example.com/tenant-api", tenantWatcherCfg.TenantAPIServerURL)
		require.Equal(t, "token", tenantWatcherCfg.Token)
		require.Equal(t, "https://example.com/token-exchange", tenantWatcherCfg.TokenExchangeURL)
		require.True(t, tenantWatcherCfg.AllowInsecure)
	})

	t.Run("returns nil when tenant api server address is missing", func(t *testing.T) {
		cfg := newCfg()
		cfg.TenantApiServerAddress = ""
		require.Nil(t, NewTenantWatcherConfig(cfg))
	})

	t.Run("returns nil when token is missing", func(t *testing.T) {
		cfg := newCfg()
		cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token").SetValue("")
		require.Nil(t, NewTenantWatcherConfig(cfg))
	})

	t.Run("returns nil when token exchange url is missing", func(t *testing.T) {
		cfg := newCfg()
		cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token_exchange_url").SetValue("")
		require.Nil(t, NewTenantWatcherConfig(cfg))
	})
}
