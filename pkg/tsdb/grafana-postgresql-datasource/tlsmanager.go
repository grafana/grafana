package postgres

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/sqleng"
)

var validateCertFunc = validateCertFilePaths
var writeCertFileFunc = writeCertFile

type certFileType int

const (
	rootCert = iota
	clientCert
	clientKey
)

type tlsSettingsProvider interface {
	getTLSSettings(dsInfo sqleng.DataSourceInfo) (tlsSettings, error)
}

type datasourceCacheManager struct {
	locker *locker
	cache  sync.Map
}

type tlsManager struct {
	logger          log.Logger
	dsCacheInstance datasourceCacheManager
	dataPath        string
}

func newTLSManager(logger log.Logger, dataPath string) tlsSettingsProvider {
	return &tlsManager{
		logger:          logger,
		dataPath:        dataPath,
		dsCacheInstance: datasourceCacheManager{locker: newLocker()},
	}
}

type tlsSettings struct {
	Mode                string
	ConfigurationMethod string
	RootCertFile        string
	CertFile            string
	CertKeyFile         string
}

func (m *tlsManager) getTLSSettings(dsInfo sqleng.DataSourceInfo) (tlsSettings, error) {
	tlsconfig := tlsSettings{
		Mode: dsInfo.JsonData.Mode,
	}

	isTLSDisabled := (tlsconfig.Mode == "disable")

	if isTLSDisabled {
		m.logger.Debug("Postgres TLS/SSL is disabled")
		return tlsconfig, nil
	}

	m.logger.Debug("Postgres TLS/SSL is enabled", "tlsMode", tlsconfig.Mode)

	tlsconfig.ConfigurationMethod = dsInfo.JsonData.ConfigurationMethod
	tlsconfig.RootCertFile = dsInfo.JsonData.RootCertFile
	tlsconfig.CertFile = dsInfo.JsonData.CertFile
	tlsconfig.CertKeyFile = dsInfo.JsonData.CertKeyFile

	if tlsconfig.ConfigurationMethod == "file-content" {
		if err := m.writeCertFiles(dsInfo, &tlsconfig); err != nil {
			return tlsconfig, err
		}
	} else {
		if err := validateCertFunc(tlsconfig.RootCertFile, tlsconfig.CertFile, tlsconfig.CertKeyFile); err != nil {
			return tlsconfig, err
		}
	}
	return tlsconfig, nil
}

func (t certFileType) String() string {
	switch t {
	case rootCert:
		return "root certificate"
	case clientCert:
		return "client certificate"
	case clientKey:
		return "client key"
	default:
		panic(fmt.Sprintf("Unrecognized certFileType %d", t))
	}
}

func getFileName(dataDir string, fileType certFileType) string {
	var filename string
	switch fileType {
	case rootCert:
		filename = "root.crt"
	case clientCert:
		filename = "client.crt"
	case clientKey:
		filename = "client.key"
	default:
		panic(fmt.Sprintf("unrecognized certFileType %s", fileType.String()))
	}
	generatedFilePath := filepath.Join(dataDir, filename)
	return generatedFilePath
}

// writeCertFile writes a certificate file.
func writeCertFile(logger log.Logger, fileContent string, generatedFilePath string) error {
	fileContent = strings.TrimSpace(fileContent)
	if fileContent != "" {
		logger.Debug("Writing cert file", "path", generatedFilePath)
		if err := os.WriteFile(generatedFilePath, []byte(fileContent), 0600); err != nil {
			return err
		}
		// Make sure the file has the permissions expected by the Postgresql driver, otherwise it will bail
		if err := os.Chmod(generatedFilePath, 0600); err != nil {
			return err
		}
		return nil
	}

	logger.Debug("Deleting cert file since no content is provided", "path", generatedFilePath)
	exists, err := fileExists(generatedFilePath)
	if err != nil {
		return err
	}
	if exists {
		if err := os.Remove(generatedFilePath); err != nil {
			return fmt.Errorf("failed to remove %q: %w", generatedFilePath, err)
		}
	}
	return nil
}

func (m *tlsManager) writeCertFiles(dsInfo sqleng.DataSourceInfo, tlsconfig *tlsSettings) error {
	m.logger.Debug("Writing TLS certificate files to disk")
	tlsRootCert := dsInfo.DecryptedSecureJSONData["tlsCACert"]
	tlsClientCert := dsInfo.DecryptedSecureJSONData["tlsClientCert"]
	tlsClientKey := dsInfo.DecryptedSecureJSONData["tlsClientKey"]
	if tlsRootCert == "" && tlsClientCert == "" && tlsClientKey == "" {
		m.logger.Debug("No TLS/SSL certificates provided")
	}

	// Calculate all files path
	workDir := filepath.Join(m.dataPath, "tls", dsInfo.UID+"generatedTLSCerts")
	tlsconfig.RootCertFile = getFileName(workDir, rootCert)
	tlsconfig.CertFile = getFileName(workDir, clientCert)
	tlsconfig.CertKeyFile = getFileName(workDir, clientKey)

	// Find datasource in the cache, if found, skip writing files
	cacheKey := strconv.Itoa(int(dsInfo.ID))
	m.dsCacheInstance.locker.RLock(cacheKey)
	item, ok := m.dsCacheInstance.cache.Load(cacheKey)
	m.dsCacheInstance.locker.RUnlock(cacheKey)
	if ok {
		if !item.(time.Time).Before(dsInfo.Updated) {
			return nil
		}
	}

	m.dsCacheInstance.locker.Lock(cacheKey)
	defer m.dsCacheInstance.locker.Unlock(cacheKey)

	item, ok = m.dsCacheInstance.cache.Load(cacheKey)
	if ok {
		if !item.(time.Time).Before(dsInfo.Updated) {
			return nil
		}
	}

	// Write certification directory and files
	exists, err := fileExists(workDir)
	if err != nil {
		return err
	}
	if !exists {
		if err := os.MkdirAll(workDir, 0700); err != nil {
			return err
		}
	}

	if err = writeCertFileFunc(m.logger, tlsRootCert, tlsconfig.RootCertFile); err != nil {
		return err
	}
	if err = writeCertFileFunc(m.logger, tlsClientCert, tlsconfig.CertFile); err != nil {
		return err
	}
	if err = writeCertFileFunc(m.logger, tlsClientKey, tlsconfig.CertKeyFile); err != nil {
		return err
	}

	// we do not want to point to cert-files that do not exist
	if tlsRootCert == "" {
		tlsconfig.RootCertFile = ""
	}

	if tlsClientCert == "" {
		tlsconfig.CertFile = ""
	}

	if tlsClientKey == "" {
		tlsconfig.CertKeyFile = ""
	}

	// Update datasource cache
	m.dsCacheInstance.cache.Store(cacheKey, dsInfo.Updated)
	return nil
}

// validateCertFilePaths validates configured certificate file paths.
func validateCertFilePaths(rootCert, clientCert, clientKey string) error {
	for _, fpath := range []string{rootCert, clientCert, clientKey} {
		if fpath == "" {
			continue
		}
		exists, err := fileExists(fpath)
		if err != nil {
			return err
		}
		if !exists {
			return sqleng.ErrCertFileNotExist
		}
	}
	return nil
}

// Exists determines whether a file/directory exists or not.
func fileExists(fpath string) (bool, error) {
	_, err := os.Stat(fpath)
	if err != nil {
		if !os.IsNotExist(err) {
			return false, err
		}
		return false, nil
	}

	return true, nil
}
