package runner

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/setting"
)

func generateTestCAPEM(t *testing.T) []byte {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	template := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "test-ca"},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(time.Hour),
		IsCA:                  true,
		KeyUsage:              x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
	}

	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	require.NoError(t, err)

	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
}

func TestBuildTLSConfig(t *testing.T) {
	t.Run("no TLS options set", func(t *testing.T) {
		tlsConfig, err := buildTLSConfig(false, "", "", "")
		require.NoError(t, err)
		require.False(t, tlsConfig.Insecure)
		require.Empty(t, tlsConfig.CertFile)
		require.Empty(t, tlsConfig.KeyFile)
		require.Empty(t, tlsConfig.CAData)
	})

	t.Run("insecure flag is passed through", func(t *testing.T) {
		tlsConfig, err := buildTLSConfig(true, "", "", "")
		require.NoError(t, err)
		require.True(t, tlsConfig.Insecure)
	})

	t.Run("cert and key files are set", func(t *testing.T) {
		tlsConfig, err := buildTLSConfig(false, "/path/to/cert.pem", "/path/to/key.pem", "")
		require.NoError(t, err)
		require.Equal(t, "/path/to/cert.pem", tlsConfig.CertFile)
		require.Equal(t, "/path/to/key.pem", tlsConfig.KeyFile)
	})

	t.Run("valid CA file is read and parsed", func(t *testing.T) {
		caPEM := generateTestCAPEM(t)
		caFile := filepath.Join(t.TempDir(), "ca.crt")
		require.NoError(t, os.WriteFile(caFile, caPEM, 0o600))

		tlsConfig, err := buildTLSConfig(false, "", "", caFile)
		require.NoError(t, err)
		require.Equal(t, caPEM, tlsConfig.CAData)
	})

	t.Run("missing CA file returns an error", func(t *testing.T) {
		_, err := buildTLSConfig(false, "", "", filepath.Join(t.TempDir(), "does-not-exist.crt"))
		require.ErrorContains(t, err, "failed to read CA certificate file")
	})

	t.Run("invalid PEM content returns an error", func(t *testing.T) {
		caFile := filepath.Join(t.TempDir(), "ca.crt")
		require.NoError(t, os.WriteFile(caFile, []byte("not a valid PEM certificate"), 0o600))

		_, err := buildTLSConfig(false, "", "", caFile)
		require.ErrorContains(t, err, "failed to parse CA certificate")
	})
}

func TestClientsShareOneTokenExchangeClient(t *testing.T) {
	cfg := setting.NewCfg()
	operator := cfg.SectionWithEnvOverrides("operator")
	operator.Key("folders_server_url").SetValue("https://folders.example")
	operator.Key("dashboards_server_url").SetValue("https://dashboards.example")
	auth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	auth.Key("token").SetValue("test-token")
	auth.Key("token_exchange_url").SetValue("https://exchange.example")

	clients := NewClients(cfg)
	first, err := clients.TokenExchangeClient()
	require.NoError(t, err)
	second, err := clients.TokenExchangeClient()
	require.NoError(t, err)
	require.Same(t, first, second)

	folders, err := clients.RESTConfig("folders_server_url", "folder.grafana.app")
	require.NoError(t, err)
	dashboards, err := clients.RESTConfig("dashboards_server_url", "dashboard.grafana.app")
	require.NoError(t, err)
	require.Equal(t, "https://folders.example", folders.Host)
	require.Equal(t, "https://dashboards.example", dashboards.Host)
	require.NotNil(t, folders.WrapTransport)
}

func TestClientsReuseExchangedTokenPerAudience(t *testing.T) {
	var mu sync.Mutex
	exchanges := map[string]int{}
	exchange := newTokenExchange(t, func(audience string) {
		mu.Lock()
		exchanges[audience]++
		mu.Unlock()
	})

	var seenTokens []string
	apiserver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		seenTokens = append(seenTokens, r.Header.Get("X-Access-Token"))
		mu.Unlock()
	}))
	t.Cleanup(apiserver.Close)

	cfg := setting.NewCfg()
	operator := cfg.SectionWithEnvOverrides("operator")
	operator.Key("folders_server_url").SetValue(apiserver.URL)
	operator.Key("folders_replica_url").SetValue(apiserver.URL)
	operator.Key("dashboards_server_url").SetValue(apiserver.URL)
	auth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	auth.Key("token").SetValue("test-token")
	auth.Key("token_exchange_url").SetValue(exchange.URL)

	clients := NewClients(cfg)
	get := func(serverURLKey, audience string) {
		restCfg, err := clients.RESTConfig(serverURLKey, audience)
		require.NoError(t, err)
		httpClient, err := rest.HTTPClientFor(restCfg)
		require.NoError(t, err)
		res, err := httpClient.Get(apiserver.URL)
		require.NoError(t, err)
		require.NoError(t, res.Body.Close())
	}
	get("folders_server_url", "folder.grafana.app")
	get("folders_replica_url", "folder.grafana.app")
	get("dashboards_server_url", "dashboard.grafana.app")

	require.Equal(t, map[string]int{"folder.grafana.app": 1, "dashboard.grafana.app": 1}, exchanges)
	require.Len(t, seenTokens, 3)
	require.Equal(t, seenTokens[0], seenTokens[1])
	require.NotEqual(t, seenTokens[0], seenTokens[2])
}

// newTokenExchange returns a token exchange server that signs a JWT per request
// and reports each exchanged audience to onExchange.
func newTokenExchange(t *testing.T, onExchange func(audience string)) *httptest.Server {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, nil)
	require.NoError(t, err)

	exchange := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req authn.TokenExchangeRequest
		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		audience := strings.Join(req.Audiences, ",")
		token, err := jwt.Signed(signer).Claims(&jwt.Claims{
			Subject: audience,
			Expiry:  jwt.NewNumericDate(time.Now().Add(time.Hour)),
		}).Serialize()
		require.NoError(t, err)
		onExchange(audience)
		_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]string{"token": token}})
	}))
	t.Cleanup(exchange.Close)
	return exchange
}

func TestClientsRetryAfterConfigError(t *testing.T) {
	cfg := setting.NewCfg()
	clients := NewClients(cfg)
	_, err := clients.TokenExchangeClient()
	require.ErrorContains(t, err, "token is required")

	auth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	auth.Key("token").SetValue("test-token")
	auth.Key("token_exchange_url").SetValue("https://exchange.example")
	_, err = clients.TokenExchangeClient()
	require.NoError(t, err, "a failed build must not be cached")
}

func TestRESTConfigPropagatesTraceContext(t *testing.T) {
	previous := otel.GetTextMapPropagator()
	otel.SetTextMapPropagator(propagation.TraceContext{})
	t.Cleanup(func() { otel.SetTextMapPropagator(previous) })

	exchange := newTokenExchange(t, func(string) {})
	var traceparent, accessToken string
	apiserver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceparent = r.Header.Get("traceparent")
		accessToken = r.Header.Get("X-Access-Token")
	}))
	t.Cleanup(apiserver.Close)

	cfg := setting.NewCfg()
	cfg.SectionWithEnvOverrides("operator").Key("folders_server_url").SetValue(apiserver.URL)
	auth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	auth.Key("token").SetValue("test-token")
	auth.Key("token_exchange_url").SetValue(exchange.URL)

	restCfg, err := NewClients(cfg).RESTConfig("folders_server_url", "folder.grafana.app")
	require.NoError(t, err)
	httpClient, err := rest.HTTPClientFor(restCfg)
	require.NoError(t, err)

	traceID := trace.TraceID{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}
	parent := trace.NewSpanContext(trace.SpanContextConfig{TraceID: traceID, SpanID: trace.SpanID{1, 2, 3, 4, 5, 6, 7, 8}, TraceFlags: trace.FlagsSampled})
	req, err := http.NewRequestWithContext(trace.ContextWithSpanContext(t.Context(), parent), http.MethodGet, apiserver.URL, nil)
	require.NoError(t, err)
	res, err := httpClient.Do(req)
	require.NoError(t, err)
	require.NoError(t, res.Body.Close())

	require.Contains(t, traceparent, traceID.String(), "the parent trace must reach the API server")
	require.NotEmpty(t, accessToken, "the exchanged token must still be sent")
}
