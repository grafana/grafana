package configuration

type Cfg struct {
	httpPort        string
	DashboardSource DashboardSourceCfg
}

type DashboardSourceCfg struct {
	sourceType string
	path       string
}
