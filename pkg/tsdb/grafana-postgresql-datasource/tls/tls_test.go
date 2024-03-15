package tls

import (
	"errors"
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"github.com/stretchr/testify/require"
)

func noReadFile(path string) ([]byte, error) {
	return nil, errors.New("not implemented")
}

func TestTLSNoMode(t *testing.T) {
	// for backward-compatibility reason,
	// when mode is unset, it defaults to `require`
	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			ConfigurationMethod: "",
		},
	}
	c, err := GetTLSConfig(dsInfo, noReadFile, "localhost")
	require.NoError(t, err)
	require.NotNil(t, c)
	require.True(t, c.InsecureSkipVerify)
}

func TestTLSDisable(t *testing.T) {
	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "disable",
			ConfigurationMethod: "",
		},
	}
	c, err := GetTLSConfig(dsInfo, noReadFile, "localhost")
	require.NoError(t, err)
	require.Nil(t, c)
}

func TestTLSRequire(t *testing.T) {
	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "require",
			ConfigurationMethod: "",
		},
	}
	c, err := GetTLSConfig(dsInfo, noReadFile, "localhost")
	require.NoError(t, err)
	require.NotNil(t, c)
	require.True(t, c.InsecureSkipVerify)
	require.Nil(t, c.RootCAs)
}

func TestTLSRequireWithRootCert(t *testing.T) {
	rootCertBytes, err := CreateRandomRootCertBytes()
	require.NoError(t, err)

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "require",
			ConfigurationMethod: "file-content",
		},
		DecryptedSecureJSONData: map[string]string{
			"tlsCACert": string(rootCertBytes),
		},
	}
	c, err := GetTLSConfig(dsInfo, noReadFile, "localhost")
	require.NoError(t, err)
	require.NotNil(t, c)
	require.True(t, c.InsecureSkipVerify)
	require.NotNil(t, c.VerifyConnection)
	require.NotNil(t, c.RootCAs) // TODO: not the best, but nothing better available
}

func TestTLSVerifyCA(t *testing.T) {
	rootCertBytes, err := CreateRandomRootCertBytes()
	require.NoError(t, err)

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "verify-ca",
			ConfigurationMethod: "file-content",
		},
		DecryptedSecureJSONData: map[string]string{
			"tlsCACert": string(rootCertBytes),
		},
	}
	c, err := GetTLSConfig(dsInfo, noReadFile, "localhost")
	require.NoError(t, err)
	require.NotNil(t, c)
	require.True(t, c.InsecureSkipVerify)
	require.NotNil(t, c.VerifyConnection)
	require.NotNil(t, c.RootCAs) // TODO: not the best, but nothing better available
}

func TestTLSVerifyCANoRootCertProvided(t *testing.T) {
	// this is ok. go will use the default system certs
	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "verify-ca",
			ConfigurationMethod: "file-content",
		},
		DecryptedSecureJSONData: map[string]string{},
	}
	_, err := GetTLSConfig(dsInfo, noReadFile, "localhost")
	require.NoError(t, err)
}

func TestTLSClientCert(t *testing.T) {
	clientKey, clientCert, err := CreateRandomClientCert()
	require.NoError(t, err)

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "require",
			ConfigurationMethod: "file-content",
		},
		DecryptedSecureJSONData: map[string]string{
			"tlsClientCert": string(clientCert),
			"tlsClientKey":  string(clientKey),
		},
	}
	c, err := GetTLSConfig(dsInfo, noReadFile, "localhost")
	require.NoError(t, err)
	require.NotNil(t, c)
	require.Len(t, c.Certificates, 1)
}

func TestTLSMethodFileContentClientCertMissingKey(t *testing.T) {
	_, clientCert, err := CreateRandomClientCert()
	require.NoError(t, err)

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "require",
			ConfigurationMethod: "file-content",
		},
		DecryptedSecureJSONData: map[string]string{
			"tlsClientCert": string(clientCert),
		},
	}
	_, err = GetTLSConfig(dsInfo, noReadFile, "localhost")
	require.ErrorIs(t, err, errPartialClientCertNoKey)
}

func TestTLSMethodFileContentClientCertMissingCert(t *testing.T) {
	clientKey, _, err := CreateRandomClientCert()
	require.NoError(t, err)

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "require",
			ConfigurationMethod: "file-content",
		},
		DecryptedSecureJSONData: map[string]string{
			"tlsClientKey": string(clientKey),
		},
	}
	_, err = GetTLSConfig(dsInfo, noReadFile, "localhost")
	require.ErrorIs(t, err, errPartialClientCertNoCert)
}

func TestTLSMethodFilePathClientCertMissingKey(t *testing.T) {
	clientKey, _, err := CreateRandomClientCert()
	require.NoError(t, err)

	readFile := newMockReadFile(map[string]([]byte){
		"path1": clientKey,
	})

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "require",
			ConfigurationMethod: "file-path",
			CertKeyFile:         "path1",
		},
	}
	_, err = GetTLSConfig(dsInfo, readFile, "localhost")
	require.ErrorIs(t, err, errPartialClientCertNoCert)
}

func TestTLSMethodFilePathClientCertMissingCert(t *testing.T) {
	_, clientCert, err := CreateRandomClientCert()
	require.NoError(t, err)

	readFile := newMockReadFile(map[string]([]byte){
		"path1": clientCert,
	})

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "require",
			ConfigurationMethod: "file-path",
			CertFile:            "path1",
		},
	}
	_, err = GetTLSConfig(dsInfo, readFile, "localhost")
	require.ErrorIs(t, err, errPartialClientCertNoKey)
}

func TestTLSVerifyFull(t *testing.T) {
	rootCertBytes, err := CreateRandomRootCertBytes()
	require.NoError(t, err)

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "verify-full",
			ConfigurationMethod: "file-content",
		},
		DecryptedSecureJSONData: map[string]string{
			"tlsCACert": string(rootCertBytes),
		},
	}
	c, err := GetTLSConfig(dsInfo, noReadFile, "localhost")
	require.NoError(t, err)
	require.NotNil(t, c)
	require.False(t, c.InsecureSkipVerify)
	require.Nil(t, c.VerifyConnection)
	require.NotNil(t, c.RootCAs) // TODO: not the best, but nothing better available
}

func TestTLSMethodFileContent(t *testing.T) {
	rootCertBytes, err := CreateRandomRootCertBytes()
	require.NoError(t, err)

	clientKey, clientCert, err := CreateRandomClientCert()
	require.NoError(t, err)

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "verify-full",
			ConfigurationMethod: "file-content",
		},
		DecryptedSecureJSONData: map[string]string{
			"tlsCACert":     string(rootCertBytes),
			"tlsClientCert": string(clientCert),
			"tlsClientKey":  string(clientKey),
		},
	}
	c, err := GetTLSConfig(dsInfo, noReadFile, "localhost")
	require.NoError(t, err)
	require.NotNil(t, c)
	require.Len(t, c.Certificates, 1)
	require.NotNil(t, c.RootCAs) // TODO: not the best, but nothing better available
}

func TestTLSMethodFilePath(t *testing.T) {
	rootCertBytes, err := CreateRandomRootCertBytes()
	require.NoError(t, err)

	clientKey, clientCert, err := CreateRandomClientCert()
	require.NoError(t, err)

	readFile := newMockReadFile(map[string]([]byte){
		"root-cert-path":   rootCertBytes,
		"client-key-path":  clientKey,
		"client-cert-path": clientCert,
	})

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "verify-full",
			ConfigurationMethod: "file-path",
			RootCertFile:        "root-cert-path",
			CertKeyFile:         "client-key-path",
			CertFile:            "client-cert-path",
		},
	}
	c, err := GetTLSConfig(dsInfo, readFile, "localhost")
	require.NoError(t, err)
	require.NotNil(t, c)
	require.Len(t, c.Certificates, 1)
	require.NotNil(t, c.RootCAs) // TODO: not the best, but nothing better available
}

func TestTLSMethodFilePathRootCertDoesNotExist(t *testing.T) {
	readFile := newMockReadFile(map[string]([]byte){})

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "verify-full",
			ConfigurationMethod: "file-path",
			RootCertFile:        "path1",
		},
	}
	_, err := GetTLSConfig(dsInfo, readFile, "localhost")
	require.ErrorIs(t, err, os.ErrNotExist)
}

func TestTLSMethodFilePathClientCertKeyDoesNotExist(t *testing.T) {
	_, clientCert, err := CreateRandomClientCert()
	require.NoError(t, err)

	readFile := newMockReadFile(map[string]([]byte){
		"cert-path": clientCert,
	})

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "require",
			ConfigurationMethod: "file-path",
			CertKeyFile:         "key-path",
			CertFile:            "cert-path",
		},
	}
	_, err = GetTLSConfig(dsInfo, readFile, "localhost")
	require.ErrorIs(t, err, os.ErrNotExist)
}

func TestTLSMethodFilePathClientCertCertDoesNotExist(t *testing.T) {
	clientKey, _, err := CreateRandomClientCert()
	require.NoError(t, err)

	readFile := newMockReadFile(map[string]([]byte){
		"key-path": clientKey,
	})

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "require",
			ConfigurationMethod: "file-path",
			CertKeyFile:         "key-path",
			CertFile:            "cert-path",
		},
	}
	_, err = GetTLSConfig(dsInfo, readFile, "localhost")
	require.ErrorIs(t, err, os.ErrNotExist)
}

// method="" equals to method="file-path"
func TestTLSMethodEmpty(t *testing.T) {
	rootCertBytes, err := CreateRandomRootCertBytes()
	require.NoError(t, err)

	clientKey, clientCert, err := CreateRandomClientCert()
	require.NoError(t, err)

	readFile := newMockReadFile(map[string]([]byte){
		"root-cert-path":   rootCertBytes,
		"client-key-path":  clientKey,
		"client-cert-path": clientCert,
	})

	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "verify-full",
			ConfigurationMethod: "",
			RootCertFile:        "root-cert-path",
			CertKeyFile:         "client-key-path",
			CertFile:            "client-cert-path",
		},
	}
	c, err := GetTLSConfig(dsInfo, readFile, "localhost")
	require.NoError(t, err)
	require.NotNil(t, c)
	require.Len(t, c.Certificates, 1)
	require.NotNil(t, c.RootCAs) // TODO: not the best, but nothing better available
}

func TestTLSVerifyFullNoRootCertProvided(t *testing.T) {
	// this is ok. go will use the default system certs
	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode:                "verify-full",
			ConfigurationMethod: "file-content",
		},
		DecryptedSecureJSONData: map[string]string{},
	}
	_, err := GetTLSConfig(dsInfo, noReadFile, "localhost")
	require.NoError(t, err)
}

func TestTLSInvalidMode(t *testing.T) {
	dsInfo := sqleng.DataSourceInfo{
		JsonData: sqleng.JsonData{
			Mode: "not-a-valid-mode",
		},
	}

	_, err := GetTLSConfig(dsInfo, noReadFile, "localhost")
	require.Error(t, err)
}

func TestTLSServerNameSetInEveryMode(t *testing.T) {
	modes := []string{"require", "verify-ca", "verify-full"}

	for _, mode := range modes {
		t.Run(mode, func(t *testing.T) {
			dsInfo := sqleng.DataSourceInfo{
				JsonData: sqleng.JsonData{
					Mode: mode,
				},
				DecryptedSecureJSONData: map[string]string{},
			}
			c, err := GetTLSConfig(dsInfo, noReadFile, "example.com")
			require.NoError(t, err)
			require.Equal(t, "example.com", c.ServerName)
		})
	}
}
