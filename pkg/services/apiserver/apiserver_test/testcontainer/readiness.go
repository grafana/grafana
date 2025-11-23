package testcontainer

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/docker/go-connections/nat"
	"github.com/testcontainers/testcontainers-go/wait"
)

// HTTPReadinessProbe creates a wait strategy that checks an HTTP endpoint.
// If timeout is 0, a default timeout of 60 seconds is used.
func HTTPReadinessProbe(port int, path string, statusCodeMin, statusCodeMax int, timeout time.Duration) wait.Strategy {
	if timeout == 0 {
		timeout = 60 * time.Second
	}
	return wait.ForHTTP(path).
		WithPort(nat.Port(fmt.Sprintf("%d/tcp", port))).
		WithStatusCodeMatcher(func(status int) bool {
			return status >= statusCodeMin && status <= statusCodeMax
		}).
		WithStartupTimeout(timeout)
}

// HTTPSReadinessProbe creates a wait strategy that checks an HTTPS endpoint with client certificates.
// If timeout is 0, a default timeout of 60 seconds is used.
func HTTPSReadinessProbe(port int, path, hostname, clientKeyPath, clientCertPath, caCertPath string, statusCodeMin, statusCodeMax int, timeout time.Duration) (wait.Strategy, error) {
	if timeout == 0 {
		timeout = 60 * time.Second
	}

	// Load client certificate and key
	clientCert, err := tls.LoadX509KeyPair(clientCertPath, clientKeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load client certificate: %w", err)
	}

	// Load CA certificate
	caCert, err := os.ReadFile(caCertPath) // #nosec G304 -- this is a test file reading from a controlled certificates directory
	if err != nil {
		return nil, fmt.Errorf("failed to read CA certificate: %w", err)
	}

	caCertPool := x509.NewCertPool()
	if !caCertPool.AppendCertsFromPEM(caCert) {
		return nil, fmt.Errorf("failed to append CA certificate")
	}

	// Create TLS configuration
	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{clientCert},
		RootCAs:      caCertPool,
		ServerName:   hostname,
	}

	return wait.ForHTTP(path).
		WithPort(nat.Port(fmt.Sprintf("%d/tcp", port))).
		WithStatusCodeMatcher(func(status int) bool {
			return status >= statusCodeMin && status <= statusCodeMax
		}).
		WithTLS(true, tlsConfig).
		WithMethod(http.MethodGet).
		WithStartupTimeout(timeout).
		WithPollInterval(1 * time.Second), nil
}

// ForListening creates a wait strategy that waits for a port to be listening.
// If timeout is 0, a default timeout of 60 seconds is used.
func ForListening(port int, timeout time.Duration) wait.Strategy {
	if timeout == 0 {
		timeout = 60 * time.Second
	}
	return wait.ForListeningPort(nat.Port(fmt.Sprintf("%d/tcp", port))).
		WithStartupTimeout(timeout)
}
