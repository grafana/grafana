package configprovider

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"
)

type ConfigProvider interface {
	Get(context.Context) *setting.Cfg
}

type OSSConfigProvider struct {
	Cfg *setting.Cfg
}

func (c *OSSConfigProvider) Get(_ context.Context) *setting.Cfg {
	return c.Cfg
}

func ProvideService(cfg *setting.Cfg) *OSSConfigProvider {
	return &OSSConfigProvider{Cfg: cfg}
}
