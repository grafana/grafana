package postgres

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/sqleng"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test getTLSSettings.
func TestPgxGetTLSSettings(t *testing.T) {
	mockValidateCertFilePathsPgx()
	t.Cleanup(resetValidateCertFilePathsPgx)

	updatedTime := time.Now()

	testCases := []struct {
		desc           string
		expErr         string
		jsonData       sqleng.JsonData
		secureJSONData map[string]string
		uid            string
		tlsSettings    tlsSettings
		updated        time.Time
	}{
		{
			desc:    "Custom TLS authentication disabled",
			updated: updatedTime,
			jsonData: sqleng.JsonData{
				Mode:                "disable",
				RootCertFile:        "i/am/coding/ca.crt",
				CertFile:            "i/am/coding/client.crt",
				CertKeyFile:         "i/am/coding/client.key",
				ConfigurationMethod: "file-path",
			},
			tlsSettings: tlsSettings{Mode: "disable"},
		},
		{
			desc:    "Custom TLS authentication with file path",
			updated: updatedTime.Add(time.Minute),
			jsonData: sqleng.JsonData{
				Mode:                "verify-full",
				ConfigurationMethod: "file-path",
				RootCertFile:        "i/am/coding/ca.crt",
				CertFile:            "i/am/coding/client.crt",
				CertKeyFile:         "i/am/coding/client.key",
			},
			tlsSettings: tlsSettings{
				Mode:                "verify-full",
				ConfigurationMethod: "file-path",
				RootCertFile:        "i/am/coding/ca.crt",
				CertFile:            "i/am/coding/client.crt",
				CertKeyFile:         "i/am/coding/client.key",
			},
		},
	}
	for _, tt := range testCases {
		t.Run(tt.desc, func(t *testing.T) {
			var settings tlsSettings
			var err error
			mng := pgxTlsManager{
				logger: backend.NewLoggerWith("logger", "tsdb.postgres"),
			}

			ds := sqleng.DataSourceInfo{
				JsonData:                tt.jsonData,
				DecryptedSecureJSONData: tt.secureJSONData,
				UID:                     tt.uid,
				Updated:                 tt.updated,
			}

			settings, err = mng.getTLSSettings(ds)

			if tt.expErr == "" {
				require.NoError(t, err, tt.desc)
				assert.Equal(t, tt.tlsSettings, settings)
			} else {
				require.Error(t, err, tt.desc)
				assert.True(t, strings.HasPrefix(err.Error(), tt.expErr),
					fmt.Sprintf("%s: %q doesn't start with %q", tt.desc, err, tt.expErr))
			}
		})
	}
}

func mockValidateCertFilePathsPgx() {
	validateCertFuncPgx = func(rootCert, clientCert, clientKey string) error {
		return nil
	}
}

func resetValidateCertFilePathsPgx() {
	validateCertFuncPgx = validateCertFilePathsPgx
}

func TestTLSManager_GetTLSSettings(t *testing.T) {
	logger := log.New()
	tlsManager := newPgxTlsManager(logger)

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "require",
			ConfigurationMethod: "file-content",
		},
		DecryptedSecureJSONData: map[string]string{
			"tlsCACert":     "root-cert-content",
			"tlsClientCert": "client-cert-content",
			"tlsClientKey":  "client-key-content",
		},
	}

	tlsConfig, err := tlsManager.getTLSSettings(dsInfo)
	require.NoError(t, err)
	assert.Equal(t, "require", tlsConfig.Mode)
	assert.NotEmpty(t, tlsConfig.RootCertFile)
	assert.NotEmpty(t, tlsConfig.CertFile)
	assert.NotEmpty(t, tlsConfig.CertKeyFile)

	// Cleanup temporary files
	tlsManager.cleanupCertFiles(tlsConfig)
	assert.NoFileExists(t, tlsConfig.RootCertFile)
	assert.NoFileExists(t, tlsConfig.CertFile)
	assert.NoFileExists(t, tlsConfig.CertKeyFile)
}

func TestTLSManager_CleanupCertFiles_FilePath(t *testing.T) {
	logger := log.New()
	tlsManager := newPgxTlsManager(logger)

	// Create temporary files for testing
	rootCertFile, err := tlsManager.writeCertFile("root-*.crt", "root-cert-content")
	require.NoError(t, err)
	clientCertFile, err := tlsManager.writeCertFile("client-*.crt", "client-cert-content")
	require.NoError(t, err)
	clientKeyFile, err := tlsManager.writeCertFile("client-*.key", "client-key-content")
	require.NoError(t, err)

	// Simulate a configuration where the method is "file-path"
	tlsConfig := tlsSettings{
		ConfigurationMethod: "file-path",
		RootCertFile:        rootCertFile,
		CertFile:            clientCertFile,
		CertKeyFile:         clientKeyFile,
	}

	// Call cleanupCertFiles
	tlsManager.cleanupCertFiles(tlsConfig)

	// Verify the files are NOT deleted
	assert.FileExists(t, rootCertFile, "Root certificate file should not be deleted")
	assert.FileExists(t, clientCertFile, "Client certificate file should not be deleted")
	assert.FileExists(t, clientKeyFile, "Client key file should not be deleted")

	// Cleanup the files manually
	err = os.Remove(rootCertFile)
	require.NoError(t, err)
	err = os.Remove(clientCertFile)
	require.NoError(t, err)
	err = os.Remove(clientKeyFile)
	require.NoError(t, err)
}

func TestTLSManager_CreateCertFiles(t *testing.T) {
	logger := log.New()
	tlsManager := newPgxTlsManager(logger)

	dsInfo := sqleng.DataSourceInfo{
		DecryptedSecureJSONData: map[string]string{
			"tlsCACert":     "root-cert-content",
			"tlsClientCert": "client-cert-content",
			"tlsClientKey":  "client-key-content",
		},
	}

	tlsConfig := tlsSettings{
		ConfigurationMethod: "file-content",
	}
	err := tlsManager.createCertFiles(dsInfo, &tlsConfig)
	require.NoError(t, err)

	assert.FileExists(t, tlsConfig.RootCertFile)
	assert.FileExists(t, tlsConfig.CertFile)
	assert.FileExists(t, tlsConfig.CertKeyFile)

	// Cleanup temporary files
	tlsManager.cleanupCertFiles(tlsConfig)
	assert.NoFileExists(t, tlsConfig.RootCertFile)
	assert.NoFileExists(t, tlsConfig.CertFile)
	assert.NoFileExists(t, tlsConfig.CertKeyFile)
}

func TestTLSManager_WriteCertFile(t *testing.T) {
	logger := log.New()
	tlsManager := newPgxTlsManager(logger)

	// Test writing a valid certificate file
	filePath, err := tlsManager.writeCertFile("test-*.crt", "test-cert-content")
	require.NoError(t, err)
	assert.FileExists(t, filePath)

	content, err := os.ReadFile(filepath.Clean(filePath))
	require.NoError(t, err)
	assert.Equal(t, "test-cert-content", string(content))

	// Cleanup the file
	err = os.Remove(filePath)
	require.NoError(t, err)
	assert.NoFileExists(t, filePath)
}

func TestTLSManager_CleanupCertFiles(t *testing.T) {
	logger := log.New()
	tlsManager := newPgxTlsManager(logger)

	// Create temporary files for testing
	rootCertFile, err := tlsManager.writeCertFile("root-*.crt", "root-cert-content")
	require.NoError(t, err)
	clientCertFile, err := tlsManager.writeCertFile("client-*.crt", "client-cert-content")
	require.NoError(t, err)
	clientKeyFile, err := tlsManager.writeCertFile("client-*.key", "client-key-content")
	require.NoError(t, err)

	tlsConfig := tlsSettings{
		ConfigurationMethod: "file-content",
		RootCertFile:        rootCertFile,
		CertFile:            clientCertFile,
		CertKeyFile:         clientKeyFile,
	}

	// Cleanup the files
	tlsManager.cleanupCertFiles(tlsConfig)

	// Verify the files are deleted
	assert.NoFileExists(t, rootCertFile)
	assert.NoFileExists(t, clientCertFile)
	assert.NoFileExists(t, clientKeyFile)
}
