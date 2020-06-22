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
	ConfigFile             string
}

type OAuthOrgRoleGroup struct {
	Role         string
	OrgID        int64
	GrafanaAdmin *bool
}

type OAuther struct {
	OAuthInfos   map[string]*OAuthInfo
	OrgToRoleMap map[string][]OAuthOrgRoleGroup
}

type OAuthOrgInfo struct {
	Role  string
	OrgId int64
}

var OAuthService *OAuther
