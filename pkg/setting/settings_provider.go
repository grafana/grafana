package setting

type SettingsProvider interface {
	Get() *Cfg
	// GetValue(sectionName string, keyName string) any
}

type OSSSettingsProvider struct {
	Cfg *Cfg
}

func (c *OSSSettingsProvider) Get() *Cfg {
	return c.Cfg
}

func ProvideService(cfg *Cfg) *OSSSettingsProvider {
	return &OSSSettingsProvider{Cfg: cfg}
}
