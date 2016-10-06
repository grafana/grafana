package setting

type OAuthInfo struct {
	ClientId, ClientSecret string
	Scopes                 []string
	State                  string
	AuthUrl, TokenUrl      string
	Enabled                bool
	AllowedDomains         []string
	ApiUrl                 string
	AllowSignup            bool
	Name                   string
	DisplayName            string
}

type OAuther struct {
	OAuthInfos map[string]*OAuthInfo
}

var OAuthService *OAuther
