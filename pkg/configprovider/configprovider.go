package configprovider

import (
	"context"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

type ConfigProvider interface {
	Get(context.Context) (*setting.Cfg, error)
	GetSections(context.Context, ...string) (*ini.File, error)
}

type OSSConfigProvider struct {
	Cfg *setting.Cfg
	log log.Logger
}

func ProvideService(cfg *setting.Cfg) (ConfigProvider, error) {
	return &OSSConfigProvider{Cfg: cfg, log: log.New("configprovider")}, nil
}

func (c *OSSConfigProvider) Get(_ context.Context) (*setting.Cfg, error) {
	c.log.Debug("OSSConfigProvider Get")
	return c.Cfg, nil
}

func (c *OSSConfigProvider) GetSections(_ context.Context, sections ...string) (*ini.File, error) {
	c.log.Debug("OSSConfigProvider GetSections")

	result := ini.Empty()
	for _, section := range sections {
		src, _ := c.Cfg.Raw.GetSection(section)
		if src == nil {
			continue
		}
		dst, err := result.NewSection(src.Name())
		if err != nil {
			return nil, err
		}
		for _, key := range src.Keys() {
			if _, err := dst.NewKey(key.Name(), key.Value()); err != nil {
				return nil, err
			}
		}
	}
	return result, nil
}
