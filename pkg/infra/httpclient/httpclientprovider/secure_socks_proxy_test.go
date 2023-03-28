package httpclientprovider

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewSecureSocksProxy(t *testing.T) {
	proxyAddress := "localhost:3000"
	serverName := "localhost"
	tempDir := t.TempDir()

	// create empty file for testing invalid configs
	tempEmptyFile := filepath.Join(tempDir, "emptyfile.txt")
	// nolint:gosec
	// The gosec G304 warning can be ignored because all values come from the test
	_, err := os.Create(tempEmptyFile)
	require.NoError(t, err)

	// generate test rootCA
	ca := &x509.Certificate{
		SerialNumber: big.NewInt(2019),
		Subject: pkix.Name{
			Organization: []string{"Grafana Labs"},
			CommonName:   "Grafana",
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().AddDate(10, 0, 0),
		IsCA:                  true,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
	}
	caPrivKey, err := rsa.GenerateKey(rand.Reader, 4096)
	require.NoError(t, err)
	caBytes, err := x509.CreateCertificate(rand.Reader, ca, ca, &caPrivKey.PublicKey, caPrivKey)
	require.NoError(t, err)
	rootCACert := filepath.Join(tempDir, "ca.cert")
	// nolint:gosec
	// The gosec G304 warning can be ignored because all values come from the test
	caCertFile, err := os.Create(rootCACert)
	require.NoError(t, err)
	err = pem.Encode(caCertFile, &pem.Block{
		Type:  "CERTIFICATE",
		Bytes: caBytes,
	})
	require.NoError(t, err)

	// generate test client cert & key
	cert := &x509.Certificate{
		SerialNumber: big.NewInt(2019),
		Subject: pkix.Name{
			Organization: []string{"Grafana Labs"},
			CommonName:   "Grafana",
		},
		NotBefore:    time.Now(),
		NotAfter:     time.Now().AddDate(10, 0, 0),
		SubjectKeyId: []byte{1, 2, 3, 4, 6},
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
		KeyUsage:     x509.KeyUsageDigitalSignature,
	}
	certPrivKey, err := rsa.GenerateKey(rand.Reader, 4096)
	require.NoError(t, err)
	certBytes, err := x509.CreateCertificate(rand.Reader, cert, ca, &certPrivKey.PublicKey, caPrivKey)
	require.NoError(t, err)
	clientCert := filepath.Join(tempDir, "client.cert")
	// nolint:gosec
	// The gosec G304 warning can be ignored because all values come from the test
	certFile, err := os.Create(clientCert)
	require.NoError(t, err)
	err = pem.Encode(certFile, &pem.Block{
		Type:  "CERTIFICATE",
		Bytes: certBytes,
	})
	require.NoError(t, err)
	clientKey := filepath.Join(tempDir, "client.key")
	// nolint:gosec
	// The gosec G304 warning can be ignored because all values come from the test
	keyFile, err := os.Create(clientKey)
	require.NoError(t, err)
	err = pem.Encode(keyFile, &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(certPrivKey),
	})
	require.NoError(t, err)

	settings := &setting.SecureSocksDSProxySettings{
		ClientCert:   clientCert,
		ClientKey:    clientKey,
		RootCA:       rootCACert,
		ServerName:   serverName,
		ProxyAddress: proxyAddress,
	}

	t.Run("New socks proxy should be properly configured when all settings are valid", func(t *testing.T) {
		require.NoError(t, newSecureSocksProxy(settings, &http.Transport{}))
	})

	t.Run("Client cert must be valid", func(t *testing.T) {
		settings.ClientCert = tempEmptyFile
		t.Cleanup(func() {
			settings.ClientCert = clientCert
		})
		require.Error(t, newSecureSocksProxy(settings, &http.Transport{}))
	})

	t.Run("Client key must be valid", func(t *testing.T) {
		settings.ClientKey = tempEmptyFile
		t.Cleanup(func() {
			settings.ClientKey = clientKey
		})
		require.Error(t, newSecureSocksProxy(settings, &http.Transport{}))
	})

	t.Run("Root CA must be valid", func(t *testing.T) {
		settings.RootCA = tempEmptyFile
		t.Cleanup(func() {
			settings.RootCA = rootCACert
		})
		require.Error(t, newSecureSocksProxy(settings, &http.Transport{}))
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
					JSONData: []byte("{ \"enableSecureSocksProxy\": \"nonbool\" }"),
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

			assert.Equal(t, tt.enabled, secureSocksProxyEnabledOnDS(opts))
		}
	})
}
