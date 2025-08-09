package configprovider

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

type ConfigProvider interface {
	Get(context.Context) *setting.Cfg
}

type OSSConfigProvider struct {
	Cfg *setting.Cfg
	log log.Logger
}

func (c *OSSConfigProvider) Get(_ context.Context) *setting.Cfg {
	c.log.Debug("OSSConfigProvider Get")
	return c.Cfg
}

func ProvideService(cfg *setting.Cfg) (ConfigProvider, error) {
	return &OSSConfigProvider{Cfg: cfg, log: log.New("configprovider")}, nil
}
