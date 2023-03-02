package pluginmod

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/config"
	plicensing "github.com/grafana/grafana/pkg/plugins/licensing"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

var _ PluginManager = (*core)(nil)

type core struct {
	*services.BasicService

	i *manager.PluginInstaller
	s *store.Service
	c *client.Decorator
	l *loader.Loader
	p *process.Manager
}

func NewCore(cfg *setting.Cfg, coreRegistry *coreplugin.Registry, reg *registry.InMemory,
	cl *client.Decorator) *core {
	pCfg := config.ProvideConfig(setting.ProvideProvider(cfg), cfg)
	cdn := pluginscdn.ProvideService(pCfg)
	proc := process.NewManager(reg)
	lic := plicensing.ProvideLicensing(cfg, &licensing.OSSLicensingService{Cfg: cfg})
	l := loader.ProvideService(pCfg, lic, signature.NewUnsignedAuthorizer(pCfg),
		reg, provider.ProvideService(coreRegistry), proc, fakes.NewFakeRoleRegistry(),
		cdn, assetpath.ProvideService(cdn))
	r := repo.ProvideService()
	srcs := sources.ProvideService(cfg, pCfg)

	c := &core{
		i: manager.ProvideInstaller(pCfg, reg, l, r),
		s: store.ProvideService(reg, srcs, l),
		c: cl,
		l: l,
		p: proc,
	}
	c.BasicService = services.NewBasicService(c.start, c.run, c.stop)
	return c
}

func (c *core) start(ctx context.Context) error {
	return nil
}

func (c *core) run(ctx context.Context) error {
	err := c.s.Run(ctx)
	if err != nil {
		return err
	}
	<-ctx.Done()
	return ctx.Err()
}

func (c *core) stop(failure error) error {
	err := c.p.Shutdown(context.Background())
	if err != nil {
		return err
	}

	return failure
}

func (c *core) Add(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error {
	return c.i.Add(ctx, pluginID, version, opts)
}

func (c *core) Remove(ctx context.Context, pluginID string) error {
	return c.i.Remove(ctx, pluginID)
}

func (c *core) Plugin(ctx context.Context, pluginID string) (plugins.PluginDTO, bool) {
	return c.s.Plugin(ctx, pluginID)
}

func (c *core) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO {
	return c.s.Plugins(ctx, pluginTypes...)
}

func (c *core) Renderer(ctx context.Context) *plugins.Plugin {
	return c.s.Renderer(ctx)
}

func (c *core) SecretsManager(ctx context.Context) *plugins.Plugin {
	return c.s.SecretsManager(ctx)
}

func (c *core) Routes() []*plugins.StaticRoute {
	return c.s.Routes()
}

func (c *core) PluginErrors() []*plugins.Error {
	return c.l.PluginErrors()
}

func (c *core) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return c.c.QueryData(ctx, req)
}

func (c *core) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return c.c.CallResource(ctx, req, sender)
}

func (c *core) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return c.c.CheckHealth(ctx, req)
}

func (c *core) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return c.c.CollectMetrics(ctx, req)
}

func (c *core) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return c.c.SubscribeStream(ctx, req)
}

func (c *core) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return c.c.PublishStream(ctx, req)
}

func (c *core) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return c.c.RunStream(ctx, req, sender)
}
