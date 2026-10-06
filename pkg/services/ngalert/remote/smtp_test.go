package remote

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/setting"
)

type failingConfigProvider struct {
	configprovider.ConfigProvider
}

func (failingConfigProvider) GetSections(context.Context, ...string) (*ini.File, error) {
	return nil, errors.New("setting service unavailable")
}

func TestLiveSmtpConfig(t *testing.T) {
	ctx := context.Background()

	t.Run("reads the settings on every call", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.InstanceName = "instance"
		smtp := cfg.Raw.Section("smtp")
		smtp.Key("host").SetValue("live:25")
		smtp.Key("from_address").SetValue("live@grafana.net")
		cfg.Raw.Section("smtp.static_headers").Key("Foo-Header").SetValue("foo")
		cfgProvider, err := configprovider.ProvideService(cfg)
		require.NoError(t, err)

		get := LiveSmtpConfig(cfgProvider, cfg)
		got := get(ctx)
		require.Equal(t, "live:25", got.Host)
		require.Equal(t, "live@grafana.net", got.FromAddress)
		require.Equal(t, "instance", got.EhloIdentity)
		require.Equal(t, map[string]string{"Foo-Header": "foo"}, got.StaticHeaders)

		smtp.Key("from_address").SetValue("updated@grafana.net")
		require.Equal(t, "updated@grafana.net", get(ctx).FromAddress)

		// Invalid settings keep the last ones read.
		cfg.Raw.Section("smtp.static_headers").Key("not-canonical").SetValue("bar")
		require.Equal(t, "updated@grafana.net", get(ctx).FromAddress)
	})

	t.Run("falls back to the startup settings if the first read fails", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.Smtp.FromAddress = "startup@grafana.net"

		got := LiveSmtpConfig(failingConfigProvider{}, cfg)(ctx)
		require.Equal(t, "startup@grafana.net", got.FromAddress)
	})
}
