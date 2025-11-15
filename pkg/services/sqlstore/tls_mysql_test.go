package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMakeCertWithSkipVerify(t *testing.T) {
	t.Run("skip-verify without CA cert path should succeed", func(t *testing.T) {
		config := &DatabaseConfig{
			Type:       "mysql",
			SslMode:    "skip-verify",
			CaCertPath: "", // Empty - should not be required
		}
		
		tlsConfig, err := makeCert(config)
		
		require.NoError(t, err)
		require.NotNil(t, tlsConfig)
		require.True(t, tlsConfig.InsecureSkipVerify)
		require.Nil(t, tlsConfig.RootCAs)
	})
	
	t.Run("skip-verify with client certs should work", func(t *testing.T) {
		config := &DatabaseConfig{
			Type:           "mysql",
			SslMode:        "skip-verify",
			CaCertPath:     "",
			ClientCertPath: "/path/to/client.crt",
			ClientKeyPath:  "/path/to/client.key",
		}
		
		tlsConfig, err := makeCert(config)
		
		require.NoError(t, err)
		require.NotNil(t, tlsConfig)
		require.True(t, tlsConfig.InsecureSkipVerify)
		require.NotNil(t, tlsConfig.GetClientCertificate)
	})
	
	t.Run("skip-verify with server cert name should work", func(t *testing.T) {
		config := &DatabaseConfig{
			Type:           "mysql",
			SslMode:        "skip-verify",
			ServerCertName: "*.mysql.database.azure.com",
		}
		
		tlsConfig, err := makeCert(config)
		
		require.NoError(t, err)
		require.NotNil(t, tlsConfig)
		require.True(t, tlsConfig.InsecureSkipVerify)
		require.Equal(t, "*.mysql.database.azure.com", tlsConfig.ServerName)
	})
}

func TestMakeCertWithoutSkipVerify(t *testing.T) {
	t.Run("ssl_mode=true without CA cert should fail", func(t *testing.T) {
		config := &DatabaseConfig{
			Type:       "mysql",
			SslMode:    "true",
			CaCertPath: "",
		}
		
		_, err := makeCert(config)
		
		require.Error(t, err)
		require.Contains(t, err.Error(), "CA cert path is required")
	})
}
