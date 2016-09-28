package setting

type OAuthInfo struct {
	ClientId, ClientSecret string
	Scopes                 []string
	AuthUrl, TokenUrl      string
	Enabled                bool
	AllowedDomains         []string
	ApiUrl                 string
	AllowSignup            bool
}

type OAuther struct {
	GitHub, Google, Twitter, Generic, GrafanaNet bool
	OAuthInfos                                   map[string]*OAuthInfo
	OAuthProviderName                            string
}

var OAuthService *OAuther
