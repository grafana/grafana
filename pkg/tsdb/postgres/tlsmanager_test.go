package postgres

import (
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	//_ "github.com/lib/pq"
	_ "gitcode.com/opengauss/openGauss-connector-go-pq"
)

var writeCertFileCallNum int

// TestDataSourceCacheManager is to test the Cache manager
func TestDataSourceCacheManager(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.DataPath = t.TempDir()
	mng := tlsManager{
		logger:          log.New("tsdb.postgres"),
		dsCacheInstance: datasourceCacheManager{locker: newLocker()},
		dataPath:        cfg.DataPath,
	}
	jsonData := sqleng.JsonData{
		Mode:                "verify-full",
		ConfigurationMethod: "file-content",
	}
	secureJSONData := map[string]string{
		"tlsClientCert": "I am client certification",
		"tlsClientKey":  "I am client key",
		"tlsCACert":     "I am CA certification",
	}

	updateTime := time.Now().Add(-5 * time.Minute)

	mockValidateCertFilePaths()
	t.Cleanup(resetValidateCertFilePaths)

	t.Run("Check datasource cache creation", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(10)
		for id := int64(1); id <= 10; id++ {
			go func(id int64) {
				ds := sqleng.DataSourceInfo{
					ID:                      id,
					Updated:                 updateTime,
					Database:                "database",
					JsonData:                jsonData,
					DecryptedSecureJSONData: secureJSONData,
					UID:                     "testData",
				}
				s := tlsSettings{}
				err := mng.writeCertFiles(ds, &s)
				require.NoError(t, err)
				wg.Done()
			}(id)
		}
		wg.Wait()

		t.Run("check cache creation is succeed", func(t *testing.T) {
			for id := int64(1); id <= 10; id++ {
				updated, ok := mng.dsCacheInstance.cache.Load(strconv.Itoa(int(id)))
				require.True(t, ok)
				require.Equal(t, updateTime, updated)
			}
		})
	})

	t.Run("Check datasource cache modification", func(t *testing.T) {
		t.Run("check when version not changed, cache and files are not updated", func(t *testing.T) {
			mockWriteCertFile()
			t.Cleanup(resetWriteCertFile)
			var wg1 sync.WaitGroup
			wg1.Add(5)
			for id := int64(1); id <= 5; id++ {
				go func(id int64) {
					ds := sqleng.DataSourceInfo{
						ID:                      1,
						Updated:                 updateTime,
						Database:                "database",
						JsonData:                jsonData,
						DecryptedSecureJSONData: secureJSONData,
						UID:                     "testData",
					}
					s := tlsSettings{}
					err := mng.writeCertFiles(ds, &s)
					require.NoError(t, err)
					wg1.Done()
				}(id)
			}
			wg1.Wait()
			assert.Equal(t, writeCertFileCallNum, 0)
		})

		t.Run("cache is updated with the last datasource version", func(t *testing.T) {
			dsV2 := sqleng.DataSourceInfo{
				ID:                      1,
				Updated:                 updateTime.Add(time.Minute),
				Database:                "database",
				JsonData:                jsonData,
				DecryptedSecureJSONData: secureJSONData,
				UID:                     "testData",
			}
			dsV3 := sqleng.DataSourceInfo{
				ID:                      1,
				Updated:                 updateTime.Add(2 * time.Minute),
				Database:                "database",
				JsonData:                jsonData,
				DecryptedSecureJSONData: secureJSONData,
				UID:                     "testData",
			}
			s := tlsSettings{}
			err := mng.writeCertFiles(dsV2, &s)
			require.NoError(t, err)
			err = mng.writeCertFiles(dsV3, &s)
			require.NoError(t, err)
			version, ok := mng.dsCacheInstance.cache.Load("1")
			require.True(t, ok)
			require.Equal(t, updateTime.Add(2*time.Minute), version)
		})
	})
}

// Test getFileName

func TestGetFileName(t *testing.T) {
	testCases := []struct {
		desc                  string
		datadir               string
		fileType              certFileType
		expErr                string
		expectedGeneratedPath string
	}{
		{
			desc:                  "Get File Name for root certification",
			datadir:               ".",
			fileType:              rootCert,
			expectedGeneratedPath: "root.crt",
		},
		{
			desc:                  "Get File Name for client certification",
			datadir:               ".",
			fileType:              clientCert,
			expectedGeneratedPath: "client.crt",
		},
		{
			desc:                  "Get File Name for client certification",
			datadir:               ".",
			fileType:              clientKey,
			expectedGeneratedPath: "client.key",
		},
	}
	for _, tt := range testCases {
		t.Run(tt.desc, func(t *testing.T) {
			generatedPath := getFileName(tt.datadir, tt.fileType)
			assert.Equal(t, tt.expectedGeneratedPath, generatedPath)
		})
	}
}

// Test getTLSSettings.
func TestGetTLSSettings(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.DataPath = t.TempDir()

	mockValidateCertFilePaths()
	t.Cleanup(resetValidateCertFilePaths)

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
		{
			desc:    "Custom TLS mode verify-full with certificate files content",
			updated: updatedTime.Add(2 * time.Minute),
			uid:     "xxx",
			jsonData: sqleng.JsonData{
				Mode:                "verify-full",
				ConfigurationMethod: "file-content",
			},
			secureJSONData: map[string]string{
				"tlsCACert":     "I am CA certification",
				"tlsClientCert": "I am client certification",
				"tlsClientKey":  "I am client key",
			},
			tlsSettings: tlsSettings{
				Mode:                "verify-full",
				ConfigurationMethod: "file-content",
				RootCertFile:        filepath.Join(cfg.DataPath, "tls", "xxxgeneratedTLSCerts", "root.crt"),
				CertFile:            filepath.Join(cfg.DataPath, "tls", "xxxgeneratedTLSCerts", "client.crt"),
				CertKeyFile:         filepath.Join(cfg.DataPath, "tls", "xxxgeneratedTLSCerts", "client.key"),
			},
		},
	}
	for _, tt := range testCases {
		t.Run(tt.desc, func(t *testing.T) {
			var settings tlsSettings
			var err error
			mng := tlsManager{
				logger:          log.New("tsdb.postgres"),
				dsCacheInstance: datasourceCacheManager{locker: newLocker()},
				dataPath:        cfg.DataPath,
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

func mockValidateCertFilePaths() {
	validateCertFunc = func(rootCert, clientCert, clientKey string) error {
		return nil
	}
}

func resetValidateCertFilePaths() {
	validateCertFunc = validateCertFilePaths
}

func mockWriteCertFile() {
	writeCertFileCallNum = 0
	writeCertFileFunc = func(logger log.Logger, fileContent string, generatedFilePath string) error {
		writeCertFileCallNum++
		return nil
	}
}

func resetWriteCertFile() {
	writeCertFileCallNum = 0
	writeCertFileFunc = writeCertFile
}
