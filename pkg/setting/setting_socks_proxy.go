package setting

import (
	"gopkg.in/ini.v1"
)

type SecureSocksDSProxySettings struct {
	ClientCert   string
	ClientKey    string
	RootCA       string
	ProxyAddress string
	ServerName   string
}

func readSecureSocksDSProxySettings(iniFile *ini.File) SecureSocksDSProxySettings {
	s := SecureSocksDSProxySettings{}
	storageSection := iniFile.Section("secure_socks_datasource_proxy")
	s.ClientCert = storageSection.Key("client_cert").MustString("")
	s.ClientKey = storageSection.Key("client_key").MustString("")
	s.RootCA = storageSection.Key("root_ca_cert").MustString("")
	s.ProxyAddress = storageSection.Key("proxy_address").MustString("")
	s.ServerName = storageSection.Key("server_name").MustString("")
	return s
}
