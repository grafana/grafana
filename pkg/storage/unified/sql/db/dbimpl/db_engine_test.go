package dbimpl

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

func newValidMySQLGetter(withKeyPrefix bool) confGetter {
	var prefix string
	if withKeyPrefix {
		prefix = "db_"
	}
	return newTestConfGetter(map[string]string{
		prefix + "type":     dbTypeMySQL,
		prefix + "host":     "/var/run/mysql.socket",
		prefix + "name":     "grafana",
		prefix + "user":     "user",
		prefix + "password": "password",
	}, prefix)
}

func TestGetEngineMySQLFromConfig(t *testing.T) {
	t.Parallel()

	t.Run("happy path - with key prefix", func(t *testing.T) {
		t.Parallel()
		engine, err := getEngineMySQL(newValidMySQLGetter(true))
		require.NotNil(t, engine)
		require.NoError(t, err)
	})

	t.Run("happy path - without key prefix", func(t *testing.T) {
		t.Parallel()
		engine, err := getEngineMySQL(newValidMySQLGetter(false))
		require.NotNil(t, engine)
		require.NoError(t, err)
	})

	t.Run("invalid string", func(t *testing.T) {
		t.Parallel()

		getter := newTestConfGetter(map[string]string{
			"db_type":     dbTypeMySQL,
			"db_host":     "/var/run/mysql.socket",
			"db_name":     string(invalidUTF8ByteSequence),
			"db_user":     "user",
			"db_password": "password",
		}, "db_")
		engine, err := getEngineMySQL(getter)
		require.Nil(t, engine)
		require.Error(t, err)
		require.ErrorIs(t, err, errInvalidUTF8Sequence)
	})
}

func newValidPostgresGetter(withKeyPrefix bool) confGetter {
	var prefix string
	if withKeyPrefix {
		prefix = "db_"
	}
	return newTestConfGetter(map[string]string{
		prefix + "type":     dbTypePostgres,
		prefix + "host":     "localhost",
		prefix + "name":     "grafana",
		prefix + "user":     "user",
		prefix + "password": "password",
	}, prefix)
}

func TestGetEnginePostgresFromConfig(t *testing.T) {
	t.Parallel()

	t.Run("happy path - with key prefix", func(t *testing.T) {
		t.Parallel()
		engine, err := getEnginePostgres(newValidPostgresGetter(true))
		require.NotNil(t, engine)
		require.NoError(t, err)
	})

	t.Run("happy path - without key prefix", func(t *testing.T) {
		t.Parallel()
		engine, err := getEnginePostgres(newValidPostgresGetter(false))
		require.NotNil(t, engine)
		require.NoError(t, err)
	})

	t.Run("invalid string", func(t *testing.T) {
		t.Parallel()
		getter := newTestConfGetter(map[string]string{
			"db_type":     dbTypePostgres,
			"db_host":     string(invalidUTF8ByteSequence),
			"db_name":     "grafana",
			"db_user":     "user",
			"db_password": "password",
		}, "db_")
		engine, err := getEnginePostgres(getter)

		require.Nil(t, engine)
		require.Error(t, err)
	})

	t.Run("invalid hostport", func(t *testing.T) {
		t.Parallel()
		getter := newTestConfGetter(map[string]string{
			"db_type":     dbTypePostgres,
			"db_host":     "1:1:1",
			"db_name":     "grafana",
			"db_user":     "user",
			"db_password": "password",
		}, "db_")
		engine, err := getEnginePostgres(getter)

		require.Nil(t, engine)
		require.Error(t, err)
	})
}

func TestGetEngineMySQLTLS(t *testing.T) {
	certs := generateTestCerts(t)

	tests := []struct {
		name      string
		config    map[string]string
		shouldErr bool
	}{
		{
			name: "with TLS disabled",
			config: map[string]string{
				"type":     "mysql",
				"user":     "user",
				"pass":     "pass",
				"host":     "localhost",
				"name":     "dbname",
				"ssl_mode": "disable",
			},
		},
		{
			name: "with TLS skip-verify",
			config: map[string]string{
				"type":     "mysql",
				"user":     "user",
				"pass":     "pass",
				"host":     "localhost",
				"name":     "dbname",
				"ssl_mode": "skip-verify",
			},
		},
		{
			name: "with valid TLS certificates",
			config: map[string]string{
				"type":             "mysql",
				"user":             "user",
				"pass":             "pass",
				"host":             "localhost",
				"name":             "dbname",
				"ssl_mode":         "true",
				"ca_cert_path":     certs.caFile,
				"client_cert_path": certs.certFile,
				"client_key_path":  certs.keyFile,
				"server_cert_name": "mysql.example.com",
			},
		},
		{
			name: "with invalid cert paths",
			config: map[string]string{
				"type":             "mysql",
				"user":             "user",
				"pass":             "pass",
				"host":             "localhost",
				"name":             "dbname",
				"ssl_mode":         "true",
				"ca_cert_path":     "nonexistent/ca.pem",
				"client_cert_path": "nonexistent/client-cert.pem",
				"client_key_path":  "nonexistent/client-key.pem",
				"server_cert_name": "mysql.example.com",
			},
			shouldErr: true,
		},
		{
			name: "with TLS certs and tls parameter",
			config: map[string]string{
				"type":             "mysql",
				"user":             "user",
				"pass":             "pass",
				"host":             "localhost",
				"name":             "dbname",
				"ssl_mode":         "true",
				"ca_cert_path":     certs.caFile,
				"client_cert_path": certs.certFile,
				"client_key_path":  certs.keyFile,
				"server_cert_name": "mysql.example.com",
				"tls":              "preferred",
			},
			shouldErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			getter := newTestConfGetter(tt.config, "")
			engine, err := getEngineMySQL(getter)

			if tt.shouldErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, engine)
		})
	}
}

type testCerts struct {
	caFile   string
	certFile string
	keyFile  string
}

func generateTestCerts(t *testing.T) testCerts {
	t.Helper()
	tempDir := t.TempDir()

	// Generate CA private key
	caKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	// Generate CA certificate
	ca := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			CommonName: "Test CA",
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().AddDate(1, 0, 0),
		IsCA:                  true,
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
	}

	caBytes, err := x509.CreateCertificate(rand.Reader, ca, ca, &caKey.PublicKey, caKey)
	require.NoError(t, err)

	clientKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	client := &x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject: pkix.Name{
			CommonName: "Test Client",
		},
		NotBefore:    time.Now(),
		NotAfter:     time.Now().AddDate(1, 0, 0),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
		SubjectKeyId: []byte{1, 2, 3, 4, 5},
	}

	clientBytes, err := x509.CreateCertificate(rand.Reader, client, ca, &clientKey.PublicKey, caKey)
	require.NoError(t, err)

	// Write certificates and keys to temporary files
	caFile := filepath.Join(tempDir, "ca.pem")
	certFile := filepath.Join(tempDir, "cert.pem")
	keyFile := filepath.Join(tempDir, "key.pem")

	writePEMFile(t, caFile, "CERTIFICATE", caBytes)
	writePEMFile(t, certFile, "CERTIFICATE", clientBytes)
	writePEMFile(t, keyFile, "RSA PRIVATE KEY", x509.MarshalPKCS1PrivateKey(clientKey))

	return testCerts{
		caFile:   caFile,
		certFile: certFile,
		keyFile:  keyFile,
	}
}

func writePEMFile(t *testing.T, filename string, blockType string, bytes []byte) {
	t.Helper()
	//nolint:gosec
	file, err := os.Create(filename)
	require.NoError(t, err)
	//nolint:errcheck
	defer file.Close()

	err = pem.Encode(file, &pem.Block{
		Type:  blockType,
		Bytes: bytes,
	})
	require.NoError(t, err)
}
