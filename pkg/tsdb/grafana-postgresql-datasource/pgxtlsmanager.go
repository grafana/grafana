package postgres

import (
	"fmt"
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/sqleng"
)

var validateCertFuncPgx = validateCertFilePathsPgx

type pgxTlsManager struct {
	logger log.Logger
}

func newPgxTlsManager(logger log.Logger) *pgxTlsManager {
	return &pgxTlsManager{
		logger: logger,
	}
}

// getTLSSettings retrieves TLS settings and handles certificate file creation if needed.
func (m *pgxTlsManager) getTLSSettings(dsInfo sqleng.DataSourceInfo) (tlsSettings, error) {
	tlsConfig := tlsSettings{
		Mode: dsInfo.JsonData.Mode,
	}

	if tlsConfig.Mode == "disable" {
		m.logger.Debug("Postgres TLS/SSL is disabled")
		return tlsConfig, nil
	}

	tlsConfig.ConfigurationMethod = dsInfo.JsonData.ConfigurationMethod
	tlsConfig.RootCertFile = dsInfo.JsonData.RootCertFile
	tlsConfig.CertFile = dsInfo.JsonData.CertFile
	tlsConfig.CertKeyFile = dsInfo.JsonData.CertKeyFile

	if tlsConfig.ConfigurationMethod == "file-content" {
		if err := m.createCertFiles(dsInfo, &tlsConfig); err != nil {
			return tlsConfig, fmt.Errorf("failed to create TLS certificate files: %w", err)
		}
	} else {
		if err := validateCertFuncPgx(tlsConfig.RootCertFile, tlsConfig.CertFile, tlsConfig.CertKeyFile); err != nil {
			return tlsConfig, fmt.Errorf("invalid TLS certificate file paths: %w", err)
		}
	}

	return tlsConfig, nil
}

// createCertFiles writes certificate files to temporary locations.
func (m *pgxTlsManager) createCertFiles(dsInfo sqleng.DataSourceInfo, tlsConfig *tlsSettings) error {
	m.logger.Debug("Writing TLS certificate files to temporary locations")

	var err error
	if tlsConfig.RootCertFile, err = m.writeCertFile("root-*.crt", dsInfo.DecryptedSecureJSONData["tlsCACert"]); err != nil {
		return err
	}
	if tlsConfig.CertFile, err = m.writeCertFile("client-*.crt", dsInfo.DecryptedSecureJSONData["tlsClientCert"]); err != nil {
		return err
	}
	if tlsConfig.CertKeyFile, err = m.writeCertFile("client-*.key", dsInfo.DecryptedSecureJSONData["tlsClientKey"]); err != nil {
		return err
	}

	return nil
}

// writeCertFile writes a single certificate file to a temporary location.
func (m *pgxTlsManager) writeCertFile(pattern, content string) (string, error) {
	if content == "" {
		return "", nil
	}

	m.logger.Debug("Writing certificate file", "pattern", pattern)
	file, err := os.CreateTemp("", pattern)
	if err != nil {
		return "", fmt.Errorf("failed to create temporary file: %w", err)
	}
	defer func() {
		if err := file.Close(); err != nil {
			m.logger.Error("Failed to close file", "error", err)
		}
	}()

	if _, err := file.WriteString(content); err != nil {
		return "", fmt.Errorf("failed to write to temporary file: %w", err)
	}

	return file.Name(), nil
}

// cleanupCertFiles removes temporary certificate files.
func (m *pgxTlsManager) cleanupCertFiles(tlsConfig tlsSettings) {
	// Only clean up if the configuration method is "file-content"
	if tlsConfig.ConfigurationMethod != "file-content" {
		m.logger.Debug("Skipping cleanup of TLS certificate files")
		return
	}
	m.logger.Debug("Cleaning up TLS certificate files")

	files := []struct {
		path string
		name string
	}{
		{tlsConfig.RootCertFile, "root certificate"},
		{tlsConfig.CertFile, "client certificate"},
		{tlsConfig.CertKeyFile, "client key"},
	}

	for _, file := range files {
		if file.path == "" {
			continue
		}
		if err := os.Remove(file.path); err != nil {
			m.logger.Error("Failed to remove file", "type", file.name, "path", file.path, "error", err)
		} else {
			m.logger.Debug("Successfully removed file", "type", file.name, "path", file.path)
		}
	}
}

// validateCertFilePaths validates the existence of configured certificate file paths.
func validateCertFilePathsPgx(rootCert, clientCert, clientKey string) error {
	for _, path := range []string{rootCert, clientCert, clientKey} {
		if path == "" {
			continue
		}
		exists, err := fileExistsPgx(path)
		if err != nil {
			return fmt.Errorf("error checking file existence: %w", err)
		}
		if !exists {
			return sqleng.ErrCertFileNotExist
		}
	}
	return nil
}

// fileExists checks if a file exists at the given path.
func fileExistsPgx(path string) (bool, error) {
	_, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}
