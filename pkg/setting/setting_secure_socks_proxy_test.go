package setting

import (
	"os"
	"strconv"
	"testing"

	sdkproxy "github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestProxySettings_NotEnabled(t *testing.T) {
	t.Run("not enabled by default", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		require.NoError(t, err)
		require.Equal(t, cfg.SecureSocksDSProxy.Enabled, false)
		require.Equal(t, "", os.Getenv(sdkproxy.PluginSecureSocksProxyEnabled))
	})
	t.Run("not enabled if settings are missing", func(t *testing.T) {
		f := ini.Empty()
		proxySec, err := f.NewSection("secure_socks_datasource_proxy")
		require.NoError(t, err)
		_, err = proxySec.NewKey("enabled", "true")
		require.NoError(t, err)
		_, err = readSecureSocksDSProxySettings(f)
		require.Error(t, err)
		require.Equal(t, "", os.Getenv(sdkproxy.PluginSecureSocksProxyEnabled))
	})
	t.Run("env variables set when enabled", func(t *testing.T) {
		f := ini.Empty()
		settings := SecureSocksDSProxySettings{
			Enabled:      true,
			ClientCert:   "client.crt",
			ClientKey:    "client.key",
			RootCA:       "ca.crt",
			ProxyAddress: "localhost:9090",
			ServerName:   "test",
		}
		proxySec, err := f.NewSection("secure_socks_datasource_proxy")
		require.NoError(t, err)
		_, err = proxySec.NewKey("enabled", strconv.FormatBool(settings.Enabled))
		require.NoError(t, err)
		_, err = proxySec.NewKey("client_cert", settings.ClientCert)
		require.NoError(t, err)
		_, err = proxySec.NewKey("client_key", settings.ClientKey)
		require.NoError(t, err)
		_, err = proxySec.NewKey("root_ca_cert", settings.RootCA)
		require.NoError(t, err)
		_, err = proxySec.NewKey("proxy_address", settings.ProxyAddress)
		require.NoError(t, err)
		_, err = proxySec.NewKey("server_name", settings.ServerName)
		require.NoError(t, err)
		actualSettings, err := readSecureSocksDSProxySettings(f)
		require.NoError(t, err)

		// settings should be read in correctly
		require.Equal(t, settings, actualSettings)

		// environment variables should be set to use in the plugin sdk
		require.Equal(t, strconv.FormatBool(settings.Enabled), os.Getenv(sdkproxy.PluginSecureSocksProxyEnabled))
		require.Equal(t, settings.ClientCert, os.Getenv(sdkproxy.PluginSecureSocksProxyClientCert))
		require.Equal(t, settings.ClientKey, os.Getenv(sdkproxy.PluginSecureSocksProxyClientKey))
		require.Equal(t, settings.RootCA, os.Getenv(sdkproxy.PluginSecureSocksProxyRootCACert))
		require.Equal(t, settings.ProxyAddress, os.Getenv(sdkproxy.PluginSecureSocksProxyProxyAddress))
		require.Equal(t, settings.ServerName, os.Getenv(sdkproxy.PluginSecureSocksProxyServerName))
	})

}
