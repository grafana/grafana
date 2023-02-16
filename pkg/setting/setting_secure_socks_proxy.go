package setting

import (
	"errors"

	"gopkg.in/ini.v1"
)

type SecureSocksDSProxySettings struct {
	Enabled      bool
	ClientCert   string
	ClientKey    string
	RootCA       string
	ProxyAddress string
	ServerName   string
}

func readSecureSocksDSProxySettings(iniFile *ini.File) (SecureSocksDSProxySettings, error) {
	s := SecureSocksDSProxySettings{}
	secureSocksProxySection := iniFile.Section("secure_socks_datasource_proxy")
	s.Enabled = secureSocksProxySection.Key("enabled").MustBool(false)
	s.ClientCert = secureSocksProxySection.Key("client_cert").MustString("")
	s.ClientKey = secureSocksProxySection.Key("client_key").MustString("")
	s.RootCA = secureSocksProxySection.Key("root_ca_cert").MustString("")
	s.ProxyAddress = secureSocksProxySection.Key("proxy_address").MustString("")
	s.ServerName = secureSocksProxySection.Key("server_name").MustString("")

	if !s.Enabled {
		return s, nil
	}

	// all fields must be specified to use the proxy
	if s.RootCA == "" {
		return s, errors.New("rootCA required")
	} else if s.ClientCert == "" || s.ClientKey == "" {
		return s, errors.New("client key pair required")
	} else if s.ServerName == "" {
		return s, errors.New("server name required")
	} else if s.ProxyAddress == "" {
		return s, errors.New("proxy address required")
	}

	return s, nil
}
