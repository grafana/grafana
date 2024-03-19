package setting

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestReadSecureSocksDSProxySettings(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	testFilePath := filepath.Join(tempDir, "test")
	testFileData := "foobar"
	err := os.WriteFile(testFilePath, []byte(testFileData), 0600)
	require.NoError(t, err)

	rootCACertFilePath := filepath.Join(tempDir, "ca.cert")
	// nolint:gosec
	caCertFile, err := os.Create(rootCACertFilePath)
	require.NoError(t, err)
	defer func() {
		err = caCertFile.Close()
		require.NoError(t, err)
	}()

	rootCaFileData := createTestRootCAFile(t, rootCACertFilePath)
	require.NoError(t, err)

	cases := []struct {
		description      string
		iniFile          *ini.File
		expectedSettings SecureSocksDSProxySettings
		expectedErr      error
	}{
		{
			description: "default values",
			iniFile: mustNewIniFile(`
		[secure_socks_datasource_proxy]
		`),
			expectedSettings: SecureSocksDSProxySettings{
				Enabled:              false,
				ShowUI:               true,
				AllowInsecure:        false,
				ClientCertFilePath:   "",
				ClientCert:           "",
				ClientKey:            "",
				ClientKeyFilePath:    "",
				RootCACerts:          nil,
				RootCACertsFilePaths: []string{},
				ProxyAddress:         "",
				ServerName:           "",
			},
		},
		{
			description: "one or more root ca is required",
			iniFile: mustNewIniFile(`
[secure_socks_datasource_proxy]
enabled = true
proxy_address = address
`),
			expectedErr: errors.New("one or more rootCA required"),
		},
		{
			description: "client cert is required",
			iniFile: mustNewIniFile(`
[secure_socks_datasource_proxy]
enabled = true
proxy_address = address
root_ca_cert = cert
`),
			expectedErr: errors.New("client key pair required"),
		},
		{
			description: "client key is required",
			iniFile: mustNewIniFile(`
[secure_socks_datasource_proxy]
enabled = true
proxy_address = address
root_ca_cert = cert1
client_cert = cert2
`),
			expectedErr: errors.New("client key pair required"),
		},
		{
			description: "server name is required",
			iniFile: mustNewIniFile(`
[secure_socks_datasource_proxy]
enabled = true
proxy_address = address
root_ca_cert = cert1
client_cert = cert2
client_key = key
`),
			expectedErr: errors.New("server name required"),
		},
		{
			description: "proxy address is required",
			iniFile: mustNewIniFile(`
[secure_socks_datasource_proxy]
enabled = true
root_ca_cert = cert1
client_cert = cert2
client_key = key
server_name = name
`),
			expectedErr: errors.New("proxy address required"),
		},
		{
			description: "root ca, client cert and client key are not required in insecure more",
			iniFile: mustNewIniFile(`
[secure_socks_datasource_proxy]
enabled = true
proxy_address = address
server_name = name
allow_insecure = true
`),
			expectedSettings: SecureSocksDSProxySettings{
				Enabled:              true,
				ProxyAddress:         "address",
				ServerName:           "name",
				ShowUI:               true,
				AllowInsecure:        true,
				RootCACertsFilePaths: []string{},
				RootCACerts:          []string{},
			},
		},
		{
			description: "custom values",
			iniFile: mustNewIniFile(fmt.Sprintf(`
		[secure_socks_datasource_proxy]
		enabled = true
		client_cert = %s
		client_key = %s
		root_ca_cert = %s
		proxy_address = proxy_address
		server_name = server_name
		show_ui = false
		allow_insecure = true
		`, testFilePath, testFilePath, rootCACertFilePath)),
			expectedSettings: SecureSocksDSProxySettings{
				Enabled:              true,
				ShowUI:               false,
				AllowInsecure:        true,
				ClientCert:           testFileData,
				ClientCertFilePath:   testFilePath,
				ClientKey:            testFileData,
				ClientKeyFilePath:    testFilePath,
				RootCACerts:          []string{rootCaFileData},
				RootCACertsFilePaths: []string{rootCACertFilePath},
				ProxyAddress:         "proxy_address",
				ServerName:           "server_name",
			},
		},
	}

	for _, tt := range cases {
		t.Run(tt.description, func(t *testing.T) {
			settings, err := readSecureSocksDSProxySettings(tt.iniFile)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedSettings, settings)
			}
		})
	}
}

func createTestRootCAFile(t *testing.T, path string) string {
	t.Helper()

	ca := &x509.Certificate{
		SerialNumber: big.NewInt(2019),
		Subject: pkix.Name{
			Organization: []string{"Grafana Labs"},
			CommonName:   "Grafana",
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().AddDate(10, 0, 0),
		IsCA:                  true,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
	}
	caPrivKey, err := rsa.GenerateKey(rand.Reader, 4096)
	require.NoError(t, err)
	caBytes, err := x509.CreateCertificate(rand.Reader, ca, ca, &caPrivKey.PublicKey, caPrivKey)
	require.NoError(t, err)

	// nolint:gosec
	caCertFile, err := os.Create(path)
	require.NoError(t, err)

	block := &pem.Block{
		Type:  "CERTIFICATE",
		Bytes: caBytes,
	}
	err = pem.Encode(caCertFile, block)
	require.NoError(t, err)

	buf := new(bytes.Buffer)
	err = pem.Encode(buf, block)
	require.NoError(t, err)

	return buf.String()
}

func mustNewIniFile(fileContents string) *ini.File {
	file, err := ini.Load([]byte(fileContents))
	if err != nil {
		panic(fmt.Sprintf("creating ini file for test: %s", err))
	}
	return file
}
