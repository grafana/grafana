package proxy

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/proxy/proxyutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewSecureSocksProxy(t *testing.T) {
	settings := proxyutil.SetupTestSecureSocksProxySettings(t)

	// create empty file for testing invalid configs
	tempDir := t.TempDir()
	tempEmptyFile := filepath.Join(tempDir, "emptyfile.txt")
	// nolint:gosec
	// The gosec G304 warning can be ignored because all values come from the test
	_, err := os.Create(tempEmptyFile)
	require.NoError(t, err)

	t.Run("New socks proxy should be properly configured when all settings are valid", func(t *testing.T) {
		require.NoError(t, NewSecureSocksHTTPProxy(settings, &http.Transport{}))
	})

	t.Run("Client cert must be valid", func(t *testing.T) {
		clientCertBefore := settings.ClientCert
		settings.ClientCert = tempEmptyFile
		t.Cleanup(func() {
			settings.ClientCert = clientCertBefore
		})
		require.Error(t, NewSecureSocksHTTPProxy(settings, &http.Transport{}))
	})

	t.Run("Client key must be valid", func(t *testing.T) {
		clientKeyBefore := settings.ClientKey
		settings.ClientKey = tempEmptyFile
		t.Cleanup(func() {
			settings.ClientKey = clientKeyBefore
		})
		require.Error(t, NewSecureSocksHTTPProxy(settings, &http.Transport{}))
	})

	t.Run("Root CA must be valid", func(t *testing.T) {
		rootCABefore := settings.RootCA
		settings.RootCA = tempEmptyFile
		t.Cleanup(func() {
			settings.RootCA = rootCABefore
		})
		require.Error(t, NewSecureSocksHTTPProxy(settings, &http.Transport{}))
	})
}

func TestSecureSocksProxyEnabledOnDS(t *testing.T) {
	t.Run("Secure socks proxy should only be enabled when the json data contains enableSecureSocksProxy=true", func(t *testing.T) {
		tests := []struct {
			instanceSettings *backend.AppInstanceSettings
			enabled          bool
		}{
			{
				instanceSettings: &backend.AppInstanceSettings{
					JSONData: []byte("{}"),
				},
				enabled: false,
			},
			{
				instanceSettings: &backend.AppInstanceSettings{
					JSONData: []byte("{ \"enableSecureSocksProxy\": false }"),
				},
				enabled: false,
			},
			{
				instanceSettings: &backend.AppInstanceSettings{
					JSONData: []byte("{ \"enableSecureSocksProxy\": true }"),
				},
				enabled: true,
			},
		}

		for _, tt := range tests {
			opts, err := tt.instanceSettings.HTTPClientOptions()
			assert.NoError(t, err)

			assert.Equal(t, tt.enabled, SecureSocksProxyEnabledOnDS(opts))
		}
	})
}
