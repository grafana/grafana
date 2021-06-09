package postgres

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
)

var validateCertFunc = validateCertFilePaths
var writeCertFileFunc = writeCertFile

type tlsSettingsProvider interface {
	getTLSSettings(dsInfo *datasourceInfo) (tlsSettings, error)
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

func (m *tlsManager) getTLSSettings(dsInfo *datasourceInfo) (tlsSettings, error) {
	isTLSDisabled := dsInfo.sslmode == "disable"

	settings := tlsSettings{}
	settings.Mode = dsInfo.sslmode

	if isTLSDisabled {
		m.logger.Debug("Postgres TLS/SSL is disabled")
		return settings, nil
	}

	m.logger.Debug("Postgres TLS/SSL is enabled", "tlsMode", dsInfo.sslmode)

	settings.ConfigurationMethod = dsInfo.tlsConfigurationMethod

	if settings.ConfigurationMethod == "file-content" {
		if err := m.writeCertFiles(dsInfo, &settings); err != nil {
			return settings, err
		}
	} else {
		settings.RootCertFile = dsInfo.sslRootCertFile
		settings.CertFile = dsInfo.sslCertFile
		settings.CertKeyFile = dsInfo.sslKeyFile
		if err := validateCertFunc(settings.RootCertFile, settings.CertFile, settings.CertKeyFile); err != nil {
			return settings, err
		}
	}
	return settings, nil
}

type certFileType int

const (
	rootCert = iota
	clientCert
	clientKey
)

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
func writeCertFile(
	dsInfo *datasourceInfo, logger log.Logger, fileContent string, generatedFilePath string) error {
	fileContent = strings.TrimSpace(fileContent)
	if fileContent != "" {
		logger.Debug("Writing cert file", "path", generatedFilePath)
		if err := ioutil.WriteFile(generatedFilePath, []byte(fileContent), 0600); err != nil {
			return err
		}
		// Make sure the file has the permissions expected by the Postgresql driver, otherwise it will bail
		if err := os.Chmod(generatedFilePath, 0600); err != nil {
			return err
		}
		return nil
	}

	logger.Debug("Deleting cert file since no content is provided", "path", generatedFilePath)
	exists, err := fs.Exists(generatedFilePath)
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

func (m *tlsManager) writeCertFiles(dsInfo *datasourceInfo, settings *tlsSettings) error {
	m.logger.Debug("Writing TLS certificate files to disk")

	if dsInfo.tlsCACert == "" && dsInfo.tlsClientCert == "" && dsInfo.tlsClientKey == "" {
		m.logger.Debug("No TLS/SSL certificates provided")
	}

	// Calculate all files path
	workDir := filepath.Join(m.dataPath, "tls", dsInfo.uid+"generatedTLSCerts")
	settings.RootCertFile = getFileName(workDir, rootCert)
	settings.CertFile = getFileName(workDir, clientCert)
	settings.CertKeyFile = getFileName(workDir, clientKey)

	// Find datasource in the cache, if found, skip writing files
	cacheKey := strconv.Itoa(int(dsInfo.datasourceID))
	m.dsCacheInstance.locker.RLock(cacheKey)
	item, ok := m.dsCacheInstance.cache.Load(cacheKey)
	m.dsCacheInstance.locker.RUnlock(cacheKey)
	if ok {
		if !item.(time.Time).Before(dsInfo.updated) {
			return nil
		}
	}

	m.dsCacheInstance.locker.Lock(cacheKey)
	defer m.dsCacheInstance.locker.Unlock(cacheKey)

	item, ok = m.dsCacheInstance.cache.Load(cacheKey)
	if ok {
		if !item.(time.Time).Before(dsInfo.updated) {
			return nil
		}
	}

	// Write certification directory and files
	exists, err := fs.Exists(workDir)
	if err != nil {
		return err
	}
	if !exists {
		if err := os.MkdirAll(workDir, 0700); err != nil {
			return err
		}
	}

	if err = writeCertFileFunc(dsInfo, m.logger, dsInfo.tlsCACert, settings.RootCertFile); err != nil {
		return err
	}
	if err = writeCertFileFunc(dsInfo, m.logger, dsInfo.tlsClientCert, settings.CertFile); err != nil {
		return err
	}
	if err = writeCertFileFunc(dsInfo, m.logger, dsInfo.tlsClientKey, settings.CertKeyFile); err != nil {
		return err
	}

	// Update datasource cache
	m.dsCacheInstance.cache.Store(cacheKey, dsInfo.updated)
	return nil
}

// validateCertFilePaths validates configured certificate file paths.
func validateCertFilePaths(rootCert, clientCert, clientKey string) error {
	for _, fpath := range []string{rootCert, clientCert, clientKey} {
		if fpath == "" {
			continue
		}
		exists, err := fs.Exists(fpath)
		if err != nil {
			return err
		}
		if !exists {
			return fmt.Errorf("certificate file %q doesn't exist", fpath)
		}
	}
	return nil
}
