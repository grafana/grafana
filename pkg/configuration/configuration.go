package configuration

type Cfg struct {
	Http HttpCfg
}

type HttpCfg struct {
	Port        string
	GoogleOAuth GoogleOAuthCfg
}

type GoogleOAuthCfg struct {
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
			GoogleOAuth: GoogleOAuthCfg{
				Enabled:      true,
				ClientId:     "106011922963-4pvl05e9urtrm8bbqr0vouosj3e8p8kb.apps.googleusercontent.com",
				ClientSecret: "K2evIa4QhfbhhAm3SO72t2Zv",
			},
		},
	}
}
