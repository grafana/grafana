package kerberos

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func TestGetKerberosSettings(t *testing.T) {
	t.Run("Should correctly parse settings", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			JSONData: []byte(`{"keytabFilePath":"keytab","credentialCache":"cache","credentialCacheLookupFile":"lookup","configFilePath":"config","UDPConnectionLimit":1,"enableDNSLookupKDC":"dns"}`),
		}

		kerberosSettings, err := GetKerberosSettings(settings)

		require.NoError(t, err)
		require.Equal(t, "keytab", kerberosSettings.KeytabFilePath)
		require.Equal(t, "cache", kerberosSettings.CredentialCache)
		require.Equal(t, "lookup", kerberosSettings.CredentialCacheLookupFile)
		require.Equal(t, "config", kerberosSettings.ConfigFilePath)
		require.Equal(t, 1, kerberosSettings.UDPConnectionLimit)
		require.Equal(t, "dns", kerberosSettings.EnableDNSLookupKDC)
	})

	t.Run("Should correctly parse legacy UDPConnectionLimit", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			JSONData: []byte(`{"UDPConnectionLimit":"0"}`),
		}

		kerberosSettings, err := GetKerberosSettings(settings)

		require.NoError(t, err)
		require.Equal(t, 0, kerberosSettings.UDPConnectionLimit)
	})

	t.Run("Should return defaults", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			JSONData: []byte(`{}`),
		}

		kerberosSettings, err := GetKerberosSettings(settings)

		require.NoError(t, err)
		require.Equal(t, "", kerberosSettings.KeytabFilePath)
		require.Equal(t, "", kerberosSettings.CredentialCache)
		require.Equal(t, "", kerberosSettings.CredentialCacheLookupFile)
		require.Equal(t, "", kerberosSettings.ConfigFilePath)
		require.Equal(t, 1, kerberosSettings.UDPConnectionLimit)
		require.Equal(t, "", kerberosSettings.EnableDNSLookupKDC)
	})

	t.Run("Will error if legacy UDPConnectionLimit can't be converted to number", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			JSONData: []byte(`{"UDPConnectionLimit":"test"}`),
		}

		_, err := GetKerberosSettings(settings)

		require.Error(t, err)
	})
}
