package setting

type ConfigProvider interface {
	Get() *Cfg
}

type OSSConfigProvider struct {
	cfg *Cfg
}

func (c *OSSConfigProvider) Get() *Cfg {
	return c.cfg
}

func ProvideService(cfg *Cfg) *OSSConfigProvider {
	return &OSSConfigProvider{cfg: cfg}
}
