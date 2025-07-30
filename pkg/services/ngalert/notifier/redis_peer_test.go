package notifier

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"os"
	"testing"
	"time"

	"github.com/Bose/minisentinel"
	"github.com/alicebob/miniredis/v2"
	dstls "github.com/grafana/dskit/crypto/tls"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/madflojo/testcerts"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

func TestNewRedisPeerClusterMode(t *testing.T) {
	// Write client and server certificates/keys to tempDir, both issued by the same CA
	certPaths := createX509TestDir(t)

	// Set up tls.Config and start miniredis with server-side TLS
	x509Cert, err := tls.LoadX509KeyPair(certPaths.serverCert, certPaths.serverKey)
	require.NoError(t, err)

	mr, err := miniredis.RunTLS(&tls.Config{
		Certificates: []tls.Certificate{x509Cert},
		ClientAuth:   tls.NoClientCert,
	})
	require.NoError(t, err)
	defer mr.Close()

	redisPeer, err := newRedisPeer(redisConfig{
		clusterMode: true,
		addr:        mr.Addr(),
		tlsEnabled:  true,
		tls: dstls.ClientConfig{
			CAPath:     certPaths.ca,
			ServerName: "localhost",
		}}, log.NewNopLogger(), prometheus.NewRegistry(), time.Second*60)
	require.NoError(t, err)

	ping := redisPeer.redis.Ping(context.Background())
	require.NoError(t, ping.Err())
}

func TestNewRedisPeerSentinelMode(t *testing.T) {
	// Can't use RunTLS here because minisentinel does not support TLS.
	mr, err := miniredis.Run()
	require.NoError(t, err)
	defer mr.Close()

	ms := minisentinel.NewSentinel(mr, minisentinel.WithReplica(mr))
	err = ms.Start()
	require.NoError(t, err)
	defer ms.Close()

	redisPeer, err := newRedisPeer(redisConfig{
		sentinelMode: true,
		masterName:   ms.MasterInfo().Name,
		addr:         ms.Addr(),
	}, log.NewNopLogger(), prometheus.NewRegistry(), time.Second*60)
	require.NoError(t, err)

	ping := redisPeer.redis.Ping(context.Background())
	require.NoError(t, ping.Err())
}

func TestNewRedisPeerWithTLS(t *testing.T) {
	// Write client and server certificates/keys to tempDir, both issued by the same CA
	certPaths := createX509TestDir(t)

	// Set up tls.Config and start miniredis with server-side TLS
	x509Cert, err := tls.LoadX509KeyPair(certPaths.serverCert, certPaths.serverKey)
	require.NoError(t, err)

	mr, err := miniredis.RunTLS(&tls.Config{
		Certificates: []tls.Certificate{x509Cert},
		ClientAuth:   tls.NoClientCert,
	})
	require.NoError(t, err)
	defer mr.Close()

	// Create redis peer with TLS enabled, server does
	// not need to verify any client certificates
	redisPeer, err := newRedisPeer(redisConfig{
		addr:       mr.Addr(),
		tlsEnabled: true,
		tls: dstls.ClientConfig{
			CAPath:     certPaths.ca,
			ServerName: "localhost",
		}}, log.NewNopLogger(), prometheus.NewRegistry(), time.Second*60)
	require.NoError(t, err)

	ping := redisPeer.redis.Ping(context.Background())
	require.NoError(t, ping.Err())
}

func TestNewRedisPeerWithMutualTLS(t *testing.T) {
	// Write client and server certificates/keys to tempDir, both issued by the same CA
	certPaths := createX509TestDir(t)

	// Set up tls.Config and start miniredis with server-side TLS
	x509Cert, err := tls.LoadX509KeyPair(certPaths.serverCert, certPaths.serverKey)
	require.NoError(t, err)
	clientCAPool := x509.NewCertPool()
	clientCAFile, err := os.ReadFile(certPaths.ca)
	require.NoError(t, err)
	clientCAPool.AppendCertsFromPEM(clientCAFile)

	mr, err := miniredis.RunTLS(&tls.Config{
		Certificates: []tls.Certificate{x509Cert},
		ClientCAs:    clientCAPool,
		ClientAuth:   tls.RequireAndVerifyClientCert,
	})
	require.NoError(t, err)
	defer mr.Close()

	// Create redis peer with client-side TLS
	redisPeer, err := newRedisPeer(redisConfig{
		addr:       mr.Addr(),
		tlsEnabled: true,
		tls: dstls.ClientConfig{
			CertPath:   certPaths.clientCert,
			KeyPath:    certPaths.clientKey,
			CAPath:     certPaths.ca,
			ServerName: "localhost",
		}}, log.NewNopLogger(), prometheus.NewRegistry(), time.Second*60)
	require.NoError(t, err)

	ping := redisPeer.redis.Ping(context.Background())
	require.NoError(t, ping.Err())
}

type certPaths struct {
	clientCert string
	clientKey  string
	serverCert string
	serverKey  string
	ca         string
}

func createX509TestDir(t *testing.T) certPaths {
	t.Helper()

	tmpDir := t.TempDir()

	ca := testcerts.NewCA()
	caCertFile, _, err := ca.ToTempFile(tmpDir)
	require.NoError(t, err)

	serverKp, err := ca.NewKeyPair("localhost")
	require.NoError(t, err)

	serverCertFile, serverKeyFile, err := serverKp.ToTempFile(tmpDir)
	require.NoError(t, err)

	clientKp, err := ca.NewKeyPair()
	require.NoError(t, err)
	clientCertFile, clientKeyFile, err := clientKp.ToTempFile(tmpDir)
	require.NoError(t, err)

	return certPaths{
		clientCert: clientCertFile.Name(),
		clientKey:  clientKeyFile.Name(),
		serverCert: serverCertFile.Name(),
		serverKey:  serverKeyFile.Name(),
		ca:         caCertFile.Name(),
	}
}
