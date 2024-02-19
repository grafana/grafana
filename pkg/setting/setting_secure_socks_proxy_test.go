package setting

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"gopkg.in/ini.v1"
)

func mustNewIniFile(fileContents string) *ini.File {
	file, err := ini.Load([]byte(fileContents))
	if err != nil {
		panic(fmt.Sprintf("creating ini file for test: %s", err))
	}
	return file
}

func TestReadSecureSocksDSProxySettings(t *testing.T) {
	t.Parallel()

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
				Enabled:       false,
				ClientCert:    "",
				ClientKey:     "",
				RootCA:        "",
				ProxyAddress:  "",
				ServerName:    "",
				ShowUI:        true,
				AllowInsecure: false,
			},
		},
		{
			description: "root ca is required",
			iniFile: mustNewIniFile(`
[secure_socks_datasource_proxy]
enabled = true
proxy_address = address
`),
			expectedErr: errors.New("rootCA required"),
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
				Enabled:       true,
				ProxyAddress:  "address",
				ServerName:    "name",
				ShowUI:        true,
				AllowInsecure: true,
			},
		},
		{
			description: "custom values",
			iniFile: mustNewIniFile(`
		[secure_socks_datasource_proxy]
		enabled = true
		client_cert = cert
		client_key = key
		root_ca_cert = root_ca
		proxy_address = proxy_address
		server_name = server_name
		show_ui = false
		allow_insecure = true
		`),
			expectedSettings: SecureSocksDSProxySettings{
				Enabled:       true,
				ClientCert:    "cert",
				ClientKey:     "key",
				RootCA:        "root_ca",
				ProxyAddress:  "proxy_address",
				ServerName:    "server_name",
				ShowUI:        false,
				AllowInsecure: true,
			},
		},
	}

	for _, tt := range cases {
		t.Run(tt.description, func(t *testing.T) {
			settings, err := readSecureSocksDSProxySettings(tt.iniFile)

			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
			} else {
				assert.Equal(t, tt.expectedSettings, settings)
				assert.NoError(t, err)
			}
		})
	}
}
