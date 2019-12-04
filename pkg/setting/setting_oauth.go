package setting

import "net/url"

type OAuthInfo struct {
	ClientId, ClientSecret       string
	Scopes                       []string
	AuthUrl, TokenUrl            string
	TokenUrlParams               url.Values
	Enabled                      bool
	EmailAttributeName           string
	EmailAttributePath           string
	RoleAttributePath            string
	AllowedDomains               []string
	HostedDomain                 string
	ApiUrl                       string
	AllowSignup                  bool
	Name                         string
	TlsClientCert                string
	TlsClientKey                 string
	TlsClientCa                  string
	TlsSkipVerify                bool
	SendClientCredentialsViaPost bool
}

type OAuther struct {
	OAuthInfos map[string]*OAuthInfo
}

var OAuthService *OAuther
