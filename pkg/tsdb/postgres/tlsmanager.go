package postgres

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

var validateCertFunc = validateCertFilePaths
var writeCertFileFunc = writeCertFile

type tlsSettingsProvider interface {
	getTLSSettings(datasource *models.DataSource) (tlsSettings, error)
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

func (m *tlsManager) getTLSSettings(datasource *models.DataSource) (tlsSettings, error) {
	tlsMode := strings.TrimSpace(strings.ToLower(datasource.JsonData.Get("sslmode").MustString("verify-full")))
	isTLSDisabled := tlsMode == "disable"

	settings := tlsSettings{}
	settings.Mode = tlsMode

	if isTLSDisabled {
		m.logger.Debug("Postgres TLS/SSL is disabled")
		return settings, nil
	}

	m.logger.Debug("Postgres TLS/SSL is enabled", "tlsMode", tlsMode)

	settings.ConfigurationMethod = strings.TrimSpace(
		strings.ToLower(datasource.JsonData.Get("tlsConfigurationMethod").MustString("file-path")))

	if settings.ConfigurationMethod == "file-content" {
		if err := m.writeCertFiles(datasource, &settings); err != nil {
			return settings, err
		}
	} else {
		settings.RootCertFile = datasource.JsonData.Get("sslRootCertFile").MustString("")
		settings.CertFile = datasource.JsonData.Get("sslCertFile").MustString("")
		settings.CertKeyFile = datasource.JsonData.Get("sslKeyFile").MustString("")
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
	ds *models.DataSource, logger log.Logger, fileContent string, generatedFilePath string) error {
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

func (m *tlsManager) writeCertFiles(ds *models.DataSource, settings *tlsSettings) error {
	m.logger.Debug("Writing TLS certificate files to disk")
	decrypted := ds.DecryptedValues()
	tlsRootCert := decrypted["tlsCACert"]
	tlsClientCert := decrypted["tlsClientCert"]
	tlsClientKey := decrypted["tlsClientKey"]

	if tlsRootCert == "" && tlsClientCert == "" && tlsClientKey == "" {
		m.logger.Debug("No TLS/SSL certificates provided")
	}

	// Calculate all files path
	workDir := filepath.Join(m.dataPath, "tls", ds.Uid+"generatedTLSCerts")
	settings.RootCertFile = getFileName(workDir, rootCert)
	settings.CertFile = getFileName(workDir, clientCert)
	settings.CertKeyFile = getFileName(workDir, clientKey)

	// Find datasource in the cache, if found, skip writing files
	cacheKey := strconv.Itoa(int(ds.Id))
	m.dsCacheInstance.locker.RLock(cacheKey)
	item, ok := m.dsCacheInstance.cache.Load(cacheKey)
	m.dsCacheInstance.locker.RUnlock(cacheKey)
	if ok {
		if item.(int) == ds.Version {
			return nil
		}
	}

	m.dsCacheInstance.locker.Lock(cacheKey)
	defer m.dsCacheInstance.locker.Unlock(cacheKey)

	item, ok = m.dsCacheInstance.cache.Load(cacheKey)
	if ok {
		if item.(int) == ds.Version {
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

	if err = writeCertFileFunc(ds, m.logger, tlsRootCert, settings.RootCertFile); err != nil {
		return err
	}
	if err = writeCertFileFunc(ds, m.logger, tlsClientCert, settings.CertFile); err != nil {
		return err
	}
	if err = writeCertFileFunc(ds, m.logger, tlsClientKey, settings.CertKeyFile); err != nil {
		return err
	}

	// Update datasource cache
	m.dsCacheInstance.cache.Store(cacheKey, ds.Version)
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
