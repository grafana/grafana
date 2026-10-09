package folder

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
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
