package router

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/setting"
)

func TestParsePluginGRPCConfig(t *testing.T) {
	t.Run("defaults", func(t *testing.T) {
		cfg, err := parsePluginGRPCConfig(setting.NewCfg())
		require.NoError(t, err)
		require.Equal(t, defaultPluginGRPCConfig(), cfg)
		// gRPC servers' default enforcement policy closes connections that ping more often.
		require.Equal(t, 5*time.Minute, cfg.Keepalive.Time)
	})

	t.Run("configured", func(t *testing.T) {
		cfg, err := parsePluginGRPCConfig(cfgWithBackendGRPCSection(t, map[string]string{
			"retry_max":          "3",
			"retry_backoff":      "1s",
			"retry_jitter":       "0.5",
			"connect_timeout":    "20s",
			"connect_base_delay": "100ms",
			"connect_max_delay":  "10s",
			"keepalive_time":     "20s",
			"keepalive_timeout":  "5s",
			"max_recv_msg_size":  "209715200",
			"max_send_msg_size":  "33554432",
		}))
		require.NoError(t, err)
		require.Equal(t, pluginGRPCConfig{
			Retry:     pluginGRPCRetryConfig{Max: 3, Backoff: time.Second, Jitter: 0.5},
			Connect:   pluginGRPCConnectConfig{Timeout: 20 * time.Second, BaseDelay: 100 * time.Millisecond, MaxDelay: 10 * time.Second},
			Keepalive: pluginGRPCKeepaliveConfig{Time: 20 * time.Second, Timeout: 5 * time.Second},
			Message:   pluginGRPCMessageConfig{MaxRecvSize: 200 << 20, MaxSendSize: 32 << 20},
		}, cfg)
	})

	for key, value := range map[string]string{
		"retry_max":          "-1",
		"retry_backoff":      "soon",
		"retry_jitter":       "1.5",
		"connect_timeout":    "0s",
		"connect_base_delay": "-1s",
		"connect_max_delay":  "0s",
		"keepalive_time":     "-1s",
		"keepalive_timeout":  "0s",
		"max_recv_msg_size":  "0",
		"max_send_msg_size":  "4MiB",
	} {
		t.Run("invalid "+key, func(t *testing.T) {
			cfg := cfgWithBackendGRPCSection(t, map[string]string{key: value})
			cfg.Raw.Section(cloudRouterSection).Key("plugins_url").SetValue("http://plugins.invalid/plugins")
			_, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
			require.ErrorContains(t, err, backendGRPCSection+": "+key+" must be")
		})
	}

	t.Run("base delay over max delay", func(t *testing.T) {
		_, err := parsePluginGRPCConfig(cfgWithBackendGRPCSection(t, map[string]string{"connect_base_delay": "11s"}))
		require.ErrorContains(t, err, "connect_base_delay (11s) must not exceed connect_max_delay (10s)")
	})
}

func cfgWithBackendGRPCSection(t *testing.T, kv map[string]string) *setting.Cfg {
	cfg := setting.NewCfg()
	section, err := cfg.Raw.NewSection(backendGRPCSection)
	require.NoError(t, err)
	for key, value := range kv {
		_, err := section.NewKey(key, value)
		require.NoError(t, err)
	}
	return cfg
}

func TestParsePluginGRPCConfigTLS(t *testing.T) {
	caFile := filepath.Join(t.TempDir(), "ca.crt")
	require.NoError(t, os.WriteFile(caFile, generateSelfSignedCAPEM(t), 0o600))

	t.Run("enabled", func(t *testing.T) {
		cfg, err := parsePluginGRPCConfig(cfgWithBackendGRPCSection(t, map[string]string{
			"tls_enabled":     "true",
			"tls_ca_file":     caFile,
			"tls_server_name": "plugin.test",
		}))
		require.NoError(t, err)
		require.NotNil(t, cfg.TLS)
		require.NotNil(t, cfg.TLS.RootCAs)
		require.False(t, cfg.TLS.InsecureSkipVerify)
		require.Equal(t, "plugin.test", cfg.TLS.ServerName)
	})

	t.Run("enabled alone trusts the system CAs", func(t *testing.T) {
		cfg, err := parsePluginGRPCConfig(cfgWithBackendGRPCSection(t, map[string]string{"tls_enabled": "true"}))
		require.NoError(t, err)
		require.NotNil(t, cfg.TLS)
		require.Nil(t, cfg.TLS.RootCAs)
		require.False(t, cfg.TLS.InsecureSkipVerify)
	})

	for key, value := range map[string]string{
		"tls_ca_file":     caFile,
		"tls_insecure":    "true",
		"tls_server_name": "plugin.test",
	} {
		t.Run(key+" without tls_enabled", func(t *testing.T) {
			_, err := parsePluginGRPCConfig(cfgWithBackendGRPCSection(t, map[string]string{key: value}))
			require.ErrorContains(t, err, backendGRPCSection+": tls_ca_file, tls_insecure and tls_server_name require tls_enabled")
		})
	}

	t.Run("missing tls_ca_file", func(t *testing.T) {
		_, err := parsePluginGRPCConfig(cfgWithBackendGRPCSection(t, map[string]string{
			"tls_enabled": "true",
			"tls_ca_file": "/does/not/exist.crt",
		}))
		require.ErrorContains(t, err, backendGRPCSection+": tls_ca_file: reading ca_file")
	})
}

func TestPluginGRPCDialOptionsTLS(t *testing.T) {
	cert, caPEM := generateServerCert(t, "plugin.test")
	caFile := filepath.Join(t.TempDir(), "ca.crt")
	require.NoError(t, os.WriteFile(caFile, caPEM, 0o600))

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	server := grpc.NewServer(grpc.Creds(credentials.NewTLS(&tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS12})))
	pluginv2.RegisterDiagnosticsServer(server, &healthyServer{})
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)

	checkHealth := func(t *testing.T, kv map[string]string) error {
		t.Helper()
		cfg, err := parsePluginGRPCConfig(cfgWithBackendGRPCSection(t, kv))
		require.NoError(t, err)
		cfg.Retry.Max = 1
		labels := prometheus.Labels{"plugin_id": "test-app"}
		requestDuration := newPluginGRPCRequestDuration(nil, sourcePluginsURL).MustCurryWith(labels).(*prometheus.HistogramVec)
		requestRetries := newPluginGRPCRequestRetries(nil, sourcePluginsURL).MustCurryWith(labels)
		conn, err := grpc.NewClient(listener.Addr().String(), cfg.dialOptions(requestDuration, requestRetries)...)
		require.NoError(t, err)
		t.Cleanup(func() { _ = conn.Close() })
		ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
		defer cancel()
		_, err = pluginv2.NewDiagnosticsClient(conn).CheckHealth(ctx, &pluginv2.CheckHealthRequest{})
		return err
	}

	t.Run("plaintext is rejected by a TLS server", func(t *testing.T) {
		require.Error(t, checkHealth(t, map[string]string{}))
	})

	t.Run("an unknown CA is rejected", func(t *testing.T) {
		require.ErrorContains(t, checkHealth(t, map[string]string{"tls_enabled": "true", "tls_server_name": "plugin.test"}), "certificate signed by unknown authority")
	})

	t.Run("a host the certificate doesn't cover is rejected", func(t *testing.T) {
		require.ErrorContains(t, checkHealth(t, map[string]string{"tls_enabled": "true", "tls_ca_file": caFile}), "doesn't contain any IP SANs")
	})

	t.Run("tls_server_name verifies against the certificate's name", func(t *testing.T) {
		require.NoError(t, checkHealth(t, map[string]string{
			"tls_enabled":     "true",
			"tls_ca_file":     caFile,
			"tls_server_name": "plugin.test",
		}))
	})

	t.Run("tls_insecure skips verification", func(t *testing.T) {
		require.NoError(t, checkHealth(t, map[string]string{"tls_enabled": "true", "tls_insecure": "true"}))
	})
}

// generateServerCert builds a throwaway self-signed server certificate for
// dnsName, returning it and its PEM to trust as a CA.
func generateServerCert(t *testing.T, dnsName string) (tls.Certificate, []byte) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	template := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: dnsName},
		DNSNames:              []string{dnsName},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(time.Hour),
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	require.NoError(t, err)
	return tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
}

type healthyServer struct {
	pluginv2.UnimplementedDiagnosticsServer
}

func (*healthyServer) CheckHealth(context.Context, *pluginv2.CheckHealthRequest) (*pluginv2.CheckHealthResponse, error) {
	return &pluginv2.CheckHealthResponse{Status: pluginv2.CheckHealthResponse_OK}, nil
}

func TestPluginGRPCDialOptionsCountRetries(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	server := grpc.NewServer()
	health := &flakyHealthServer{}
	pluginv2.RegisterDiagnosticsServer(server, health)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)

	labels := prometheus.Labels{"plugin_id": "test-app"}
	requestDuration := newPluginGRPCRequestDuration(nil, sourcePluginsURL).MustCurryWith(labels).(*prometheus.HistogramVec)
	requestRetries := newPluginGRPCRequestRetries(nil, sourcePluginsURL).MustCurryWith(labels)
	cfg := defaultPluginGRPCConfig()
	cfg.Retry = pluginGRPCRetryConfig{Max: 3, Backoff: time.Millisecond}
	conn, err := grpc.NewClient(listener.Addr().String(), cfg.dialOptions(requestDuration, requestRetries)...)
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })

	const method = "/pluginv2.Diagnostics/CheckHealth"
	_, err = pluginv2.NewDiagnosticsClient(conn).CheckHealth(t.Context(), &pluginv2.CheckHealthRequest{})
	require.NoError(t, err)
	require.Equal(t, int32(2), health.calls.Load())
	require.Equal(t, 1.0, testutil.ToFloat64(requestRetries.WithLabelValues(method)))
	require.Equal(t, uint64(1), histogramCount(t, requestDuration.WithLabelValues(method, "OK")), "a retried call is recorded once")
}

// flakyHealthServer fails its first call with Unavailable.
type flakyHealthServer struct {
	pluginv2.UnimplementedDiagnosticsServer
	calls atomic.Int32
}

func (s *flakyHealthServer) CheckHealth(context.Context, *pluginv2.CheckHealthRequest) (*pluginv2.CheckHealthResponse, error) {
	if s.calls.Add(1) == 1 {
		return nil, status.Error(codes.Unavailable, "not yet")
	}
	return &pluginv2.CheckHealthResponse{Status: pluginv2.CheckHealthResponse_OK}, nil
}
