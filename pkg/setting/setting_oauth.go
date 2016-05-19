package setting

type OAuthInfo struct {
	ClientId, ClientSecret string
	Scopes                 []string
	AuthUrl, TokenUrl      string
	Enabled                bool
	AllowedDomains         []string
	ApiUrl                 string
	AllowSignup            bool
	ProviderName           string
}

type OAuther struct {
	GitHub, Google, Twitter, Openidc bool
	OAuthInfos                       map[string]*OAuthInfo
}

var OAuthService *OAuther
