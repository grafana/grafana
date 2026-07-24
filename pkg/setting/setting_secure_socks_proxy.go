package setting

import (
	"encoding/pem"
	"errors"
	"os"

	"gopkg.in/ini.v1"
)

type SecureSocksDSProxySettings struct {
	Enabled            bool
	ShowUI             bool
	AllowInsecure      bool
	ClientCert         string
	ClientCertFilePath string
	ClientKey          string
	ClientKeyFilePath  string
	RootCAs            []string
	RootCAFilePaths    []string
	ProxyAddress       string
	ServerName         string
}

func readSecureSocksDSProxySettings(iniFile *ini.File) (SecureSocksDSProxySettings, error) {
	s := SecureSocksDSProxySettings{
		RootCAs:         []string{},
		RootCAFilePaths: []string{},
	}
	secureSocksProxySection := iniFile.Section("secure_socks_datasource_proxy")
	s.Enabled = secureSocksProxySection.Key("enabled").MustBool(false)
	s.ProxyAddress = secureSocksProxySection.Key("proxy_address").MustString("")
	s.ServerName = secureSocksProxySection.Key("server_name").MustString("")
	s.ShowUI = secureSocksProxySection.Key("show_ui").MustBool(true)
	s.AllowInsecure = secureSocksProxySection.Key("allow_insecure").MustBool(false)
	s.ClientCertFilePath = secureSocksProxySection.Key("client_cert").MustString("")
	s.ClientKeyFilePath = secureSocksProxySection.Key("client_key").MustString("")
	s.RootCAFilePaths = secureSocksProxySection.Key("root_ca_cert").Strings(" ")

	if !s.Enabled {
		return s, nil
	}

	if s.ProxyAddress == "" {
		return s, errors.New("proxy address required")
	}

	// If the proxy is going to use TLS.
	if !s.AllowInsecure {
		// all fields must be specified to use the proxy
		if len(s.RootCAFilePaths) == 0 {
			return s, errors.New("one or more rootCA required")
		} else if s.ClientCertFilePath == "" || s.ClientKeyFilePath == "" {
			return s, errors.New("client key pair required")
		} else if s.ServerName == "" {
			return s, errors.New("server name required")
		}
	} else {
		return s, nil
	}

	if s.ClientCertFilePath != "" {
		certPEMBlock, err := os.ReadFile(s.ClientCertFilePath)
		if err != nil {
			return s, err
		}
		s.ClientCert = string(certPEMBlock)
	}

	if s.ClientKeyFilePath != "" {
		keyPEMBlock, err := os.ReadFile(s.ClientKeyFilePath)
		if err != nil {
			return s, err
		}
		s.ClientKey = string(keyPEMBlock)
	}

	rootCAs := make([]string, 0, len(s.RootCAFilePaths))
	for _, rootCAFile := range s.RootCAFilePaths {
		// nolint:gosec
		// The gosec G304 warning can be ignored because `rootCAFile` comes from config ini, and we check below if
		// it's the right file type.
		pemBytes, err := os.ReadFile(rootCAFile)
		if err != nil {
			return s, err
		}

		pemDecoded, _ := pem.Decode(pemBytes)
		if pemDecoded == nil || pemDecoded.Type != "CERTIFICATE" {
			return s, errors.New("root ca is invalid")
		}
		rootCAs = append(rootCAs, string(pemBytes))
	}
	s.RootCAs = rootCAs

	return s, nil
}
