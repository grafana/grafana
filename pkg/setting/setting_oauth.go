package setting

type OAuthInfo struct {
	Enabled                bool
	AllowSignup            bool
	TlsSkipVerify          bool
	ClientId, ClientSecret string
	Scopes                 []string
	AuthUrl, TokenUrl      string
	EmailAttributeName     string
	AllowedDomains         []string
	HostedDomain           string
	ApiUrl                 string
	Name                   string
	TlsClientCert          string
	TlsClientKey           string
	TlsClientCa            string
}

type OAuther struct {
	OAuthInfos map[string]*OAuthInfo
}

var OAuthService *OAuther
