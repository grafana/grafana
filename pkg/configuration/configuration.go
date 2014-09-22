package configuration

type Cfg struct {
	Http HttpCfg
}

type HttpCfg struct {
	Port        string
	GoogleOAuth OAuthCfg
	GithubOAuth OAuthCfg
}

type OAuthCfg struct {
	Enabled      bool
	ClientId     string
	ClientSecret string
}

type DashboardSourceCfg struct {
	sourceType string
	path       string
}

func NewCfg(port string) *Cfg {
	return &Cfg{
		Http: HttpCfg{
			Port: port,
			GoogleOAuth: OAuthCfg{
				Enabled:      true,
				ClientId:     "106011922963-4pvl05e9urtrm8bbqr0vouosj3e8p8kb.apps.googleusercontent.com",
				ClientSecret: "K2evIa4QhfbhhAm3SO72t2Zv",
			},
			GithubOAuth: OAuthCfg{
				Enabled:      true,
				ClientId:     "de054205006b9baa2e17",
				ClientSecret: "72b7ea52d9f1096fdf36cea95e95362a307e0322",
			},
		},
	}
}
