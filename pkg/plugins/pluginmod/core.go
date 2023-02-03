package pluginmod

import (
	"context"
	"fmt"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/config"
	plicensing "github.com/grafana/grafana/pkg/plugins/licensing"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

var _ PluginManager = (*core)(nil)

type core struct {
	*services.BasicService

	i *manager.PluginInstaller
}

func NewCore(cfg *setting.Cfg) *core {
	pCfg := config.ProvideConfig(setting.ProvideProvider(cfg), cfg)
	reg := registry.ProvideService()
	cdn := pluginscdn.ProvideService(pCfg)
	lic := plicensing.ProvideLicensing(cfg, &licensing.OSSLicensingService{Cfg: cfg})
	coreRegistry := coreplugin.NewRegistry(map[string]backendplugin.PluginFactoryFunc{})
	l := loader.ProvideService(pCfg, lic, signature.NewUnsignedAuthorizer(pCfg),
		reg, provider.ProvideService(coreRegistry), fakes.NewFakeRoleRegistry(),
		cdn, assetpath.ProvideService(cdn))
	r := repo.ProvideService()

	c := &core{
		i: manager.ProvideInstaller(pCfg, reg, l, r),
	}
	c.BasicService = services.NewBasicService(c.start, c.run, c.stop)
	return c
}

func (c *core) start(ctx context.Context) error {
	fmt.Println("Starting local...")

	return nil
}

func (c *core) run(ctx context.Context) error {
	fmt.Println("Running local...")

	<-ctx.Done()
	return nil
}

func (c *core) stop(failure error) error {
	fmt.Println("Stopping local...")

	return failure
}

func (c *core) Add(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error {
	return c.i.Add(ctx, pluginID, version, opts)
}

func (c *core) Remove(ctx context.Context, pluginID string) error {
	return c.i.Remove(ctx, pluginID)
}
