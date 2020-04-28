package setting

type OAuthInfo struct {
	ClientId, ClientSecret string
	Scopes                 []string
	AuthUrl, TokenUrl      string
	Enabled                bool
	EmailAttributeName     string
	EmailAttributePath     string
	RoleAttributePath      string
	AllowedDomains         []string
	HostedDomain           string
	ApiUrl                 string
	AllowSignup            bool
	Name                   string
	TlsClientCert          string
	TlsClientKey           string
	TlsClientCa            string
	TlsSkipVerify          bool
	GroupMappings          []OAuthGroupMapping `ini:",,,nonunique"`
}

type OAuthGroupMapping struct {
	RoleAttributePath string `ini:"role_attribute_path"`
	Role              string
	OrgId             int  `ini:"org_id"`
	IsGrafanaAdmin    bool `ini:"grafana_admin"`
}

type OAuther struct {
	OAuthInfos map[string]*OAuthInfo
}

var OAuthService *OAuther
