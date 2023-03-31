package pluginmod

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/filestore"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/licensing"
	plicensing "github.com/grafana/grafana/pkg/services/pluginsintegration/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

var _ PluginManager = (*core)(nil)

type core struct {
	*services.BasicService

	i   *manager.PluginInstaller
	s   *store.Service
	c   *client.Decorator
	l   *loader.Loader
	p   *process.Manager
	fs  *filestore.Service
	log log.Logger
}

func NewCore(cfg *setting.Cfg, coreRegistry *coreplugin.Registry, reg *registry.InMemory,
	cl *client.Decorator) (*core, error) {
	pCfg, err := config.ProvideConfig(setting.ProvideProvider(cfg), cfg)
	if err != nil {
		return nil, err
	}
	cdn := pluginscdn.ProvideService(pCfg)
	proc := process.NewManager(reg)
	lic := plicensing.ProvideLicensing(cfg, &licensing.OSSLicensingService{Cfg: cfg})
	l := loader.ProvideService(pCfg, lic, signature.NewUnsignedAuthorizer(pCfg),
		reg, provider.ProvideService(coreRegistry), proc, fakes.NewFakeRoleRegistry(),
		cdn, assetpath.ProvideService(cdn), finder.NewLocalFinder())
	r := repo.ProvideService()
	srcs := sources.ProvideService(cfg, pCfg)

	s := store.ProvideService(reg, srcs, l)
	c := &core{
		i:   manager.ProvideInstaller(pCfg, reg, l, r),
		s:   s,
		c:   cl,
		l:   l,
		p:   proc,
		fs:  filestore.ProvideService(reg),
		log: log.New("plugin.manager"),
	}
	c.BasicService = services.NewBasicService(c.start, c.run, c.stop)
	return c, nil
}

func (c *core) start(ctx context.Context) error {
	c.log.Info("Starting plugin manager...")
	err := c.s.Run(ctx)
	if err != nil {
		return err
	}
	return nil
}

func (c *core) run(ctx context.Context) error {
	c.log.Info("Running plugin manager...")
	<-ctx.Done()
	return ctx.Err()
}

func (c *core) stop(failure error) error {
	c.log.Info("Stopping plugin manager...")
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

func (c *core) File(ctx context.Context, pluginID, filename string) (*plugins.File, error) {
	return c.fs.File(ctx, pluginID, filename)
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
