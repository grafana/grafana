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
	GroupMappingsFile      string
	GroupMappings          []OAuthGroupMapping
}

type OAuthGroupMapping struct {
	Filter         string
	OrgMemberships map[int64]string
	IsGrafanaAdmin *bool
}

type OAuther struct {
	OAuthInfos map[string]*OAuthInfo
}

var OAuthService *OAuther
