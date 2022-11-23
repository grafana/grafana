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

	"github.com/grafana/grafana/pkg/services/validations"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestHTTPClientProvider(t *testing.T) {
	t.Run("When creating new provider and SigV4 is disabled should apply expected middleware", func(t *testing.T) {
		origNewProviderFunc := newProviderFunc
		providerOpts := []sdkhttpclient.ProviderOptions{}
		newProviderFunc = func(opts ...sdkhttpclient.ProviderOptions) *sdkhttpclient.Provider {
			providerOpts = opts
			return nil
		}
		t.Cleanup(func() {
			newProviderFunc = origNewProviderFunc
		})
		tracer := tracing.InitializeTracerForTest()
		_ = New(&setting.Cfg{SigV4AuthEnabled: false}, &validations.OSSPluginRequestValidator{}, tracer)
		require.Len(t, providerOpts, 1)
		o := providerOpts[0]
		require.Len(t, o.Middlewares, 8)
		require.Equal(t, TracingMiddlewareName, o.Middlewares[0].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, DataSourceMetricsMiddlewareName, o.Middlewares[1].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, SetUserAgentMiddlewareName, o.Middlewares[2].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.BasicAuthenticationMiddlewareName, o.Middlewares[3].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.CustomHeadersMiddlewareName, o.Middlewares[4].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.ContextualMiddlewareName, o.Middlewares[5].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, ResponseLimitMiddlewareName, o.Middlewares[6].(sdkhttpclient.MiddlewareName).MiddlewareName())
	})

	t.Run("When creating new provider and SigV4 is enabled should apply expected middleware", func(t *testing.T) {
		origNewProviderFunc := newProviderFunc
		providerOpts := []sdkhttpclient.ProviderOptions{}
		newProviderFunc = func(opts ...sdkhttpclient.ProviderOptions) *sdkhttpclient.Provider {
			providerOpts = opts
			return nil
		}
		t.Cleanup(func() {
			newProviderFunc = origNewProviderFunc
		})
		tracer := tracing.InitializeTracerForTest()
		_ = New(&setting.Cfg{SigV4AuthEnabled: true}, &validations.OSSPluginRequestValidator{}, tracer)
		require.Len(t, providerOpts, 1)
		o := providerOpts[0]
		require.Len(t, o.Middlewares, 9)
		require.Equal(t, TracingMiddlewareName, o.Middlewares[0].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, DataSourceMetricsMiddlewareName, o.Middlewares[1].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, SetUserAgentMiddlewareName, o.Middlewares[2].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.BasicAuthenticationMiddlewareName, o.Middlewares[3].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.CustomHeadersMiddlewareName, o.Middlewares[4].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.ContextualMiddlewareName, o.Middlewares[5].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, ResponseLimitMiddlewareName, o.Middlewares[6].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, SigV4MiddlewareName, o.Middlewares[8].(sdkhttpclient.MiddlewareName).MiddlewareName())
	})

	t.Run("When creating new provider and http logging is enabled for one plugin, it should apply expected middleware", func(t *testing.T) {
		origNewProviderFunc := newProviderFunc
		providerOpts := []sdkhttpclient.ProviderOptions{}
		newProviderFunc = func(opts ...sdkhttpclient.ProviderOptions) *sdkhttpclient.Provider {
			providerOpts = opts
			return nil
		}
		t.Cleanup(func() {
			newProviderFunc = origNewProviderFunc
		})
		tracer := tracing.InitializeTracerForTest()
		_ = New(&setting.Cfg{PluginSettings: setting.PluginSettings{"example": {"har_log_enabled": "true"}}}, &validations.OSSPluginRequestValidator{}, tracer)
		require.Len(t, providerOpts, 1)
		o := providerOpts[0]
		require.Len(t, o.Middlewares, 9)
		require.Equal(t, TracingMiddlewareName, o.Middlewares[0].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, DataSourceMetricsMiddlewareName, o.Middlewares[1].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, SetUserAgentMiddlewareName, o.Middlewares[2].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.BasicAuthenticationMiddlewareName, o.Middlewares[3].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.CustomHeadersMiddlewareName, o.Middlewares[4].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.ContextualMiddlewareName, o.Middlewares[5].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, ResponseLimitMiddlewareName, o.Middlewares[6].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, HostRedirectValidationMiddlewareName, o.Middlewares[7].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, HTTPLoggerMiddlewareName, o.Middlewares[8].(sdkhttpclient.MiddlewareName).MiddlewareName())
	})
}

func TestNewSecureSocksProxy(t *testing.T) {
	proxyAddress := "localhost:3000"
	serverName := "localhost"
	tempDir := t.TempDir()

	// create empty file for testing invalid configs
	tempEmptyFile := filepath.Join(tempDir, "emptyfile.txt")
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
	caCertFile, err := os.Create(rootCACert)
	require.NoError(t, err)
	pem.Encode(caCertFile, &pem.Block{
		Type:  "CERTIFICATE",
		Bytes: caBytes,
	})

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
	certFile, err := os.Create(clientCert)
	require.NoError(t, err)
	pem.Encode(certFile, &pem.Block{
		Type:  "CERTIFICATE",
		Bytes: certBytes,
	})
	clientKey := filepath.Join(tempDir, "client.key")
	keyFile, err := os.Create(clientKey)
	require.NoError(t, err)
	pem.Encode(keyFile, &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(certPrivKey),
	})

	settings := &setting.Cfg{SecureSocksDSProxy: setting.SecureSocksDSProxySettings{
		ClientCert:   clientCert,
		ClientKey:    clientKey,
		RootCA:       rootCACert,
		ServerName:   serverName,
		ProxyAddress: proxyAddress,
	}}

	t.Run("New socks proxy should be properly configured when all settings are valid", func(t *testing.T) {
		require.NoError(t, newSecureSocksProxy(settings, &http.Transport{}))
	})

	t.Run("Client cert must be valid", func(t *testing.T) {
		settings.SecureSocksDSProxy.ClientCert = tempEmptyFile
		t.Cleanup(func() {
			settings.SecureSocksDSProxy.ClientCert = clientCert
		})
		require.Error(t, newSecureSocksProxy(settings, &http.Transport{}))
	})

	t.Run("Client key must be valid", func(t *testing.T) {
		settings.SecureSocksDSProxy.ClientKey = tempEmptyFile
		t.Cleanup(func() {
			settings.SecureSocksDSProxy.ClientKey = clientKey
		})
		require.Error(t, newSecureSocksProxy(settings, &http.Transport{}))
	})

	t.Run("Root CA must be valid", func(t *testing.T) {
		settings.SecureSocksDSProxy.RootCA = tempEmptyFile
		t.Cleanup(func() {
			settings.SecureSocksDSProxy.RootCA = rootCACert
		})
		require.Error(t, newSecureSocksProxy(settings, &http.Transport{}))
	})

	t.Run("Proxy address is required", func(t *testing.T) {
		settings.SecureSocksDSProxy.ProxyAddress = ""
		t.Cleanup(func() {
			settings.SecureSocksDSProxy.ProxyAddress = proxyAddress
		})
		require.Error(t, newSecureSocksProxy(settings, &http.Transport{}))
	})

	t.Run("Server name is required", func(t *testing.T) {
		settings.SecureSocksDSProxy.ServerName = ""
		t.Cleanup(func() {
			settings.SecureSocksDSProxy.ServerName = serverName
		})
		require.Error(t, newSecureSocksProxy(settings, &http.Transport{}))
	})
}
