package plugincontext

import (
	"context"
	"runtime"

	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/useragent"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/adapters"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

type BasePluginContextProvider interface {
	// GetBasePluginContext returns a plugin context for the given plugin and user.
	// It does not add DatasourceInstaceSettings or AppInstanceSettings
	GetBasePluginContext(ctx context.Context, plugin pluginstore.Plugin, user identity.Requester) backend.PluginContext
}

func ProvideBaseService(cfg *setting.Cfg, pluginRequestConfigProvider pluginconfig.PluginRequestConfigProvider) *BaseProvider {
	return newBaseProvider(cfg, pluginRequestConfigProvider)
}

func newBaseProvider(cfg *setting.Cfg, pluginRequestConfigProvider pluginconfig.PluginRequestConfigProvider) *BaseProvider {
	return &BaseProvider{
		cfg:                         cfg,
		pluginRequestConfigProvider: pluginRequestConfigProvider,
		logger:                      log.New("base.plugin.context"),
	}
}

type BaseProvider struct {
	cfg                         *setting.Cfg
	pluginRequestConfigProvider pluginconfig.PluginRequestConfigProvider
	logger                      log.Logger
}

func (p *BaseProvider) GetBasePluginContext(ctx context.Context, plugin pluginstore.Plugin, user identity.Requester) backend.PluginContext {
	ns, _ := request.NamespaceFrom(ctx)
	pCtx := backend.PluginContext{
		PluginID:      plugin.ID,
		PluginVersion: plugin.Info.Version,
		Namespace:     ns,
	}
	if user != nil && !user.IsNil() {
		pCtx.OrgID = user.GetOrgID() // nolint:staticcheck
		pCtx.User = adapters.BackendUserFromSignedInUser(user)
		if ns == "" {
			pCtx.Namespace = user.GetNamespace()
		}
	}

	settings := p.pluginRequestConfigProvider.PluginRequestConfig(ctx, plugin.ID, plugin.ExternalService)
	pCtx.GrafanaConfig = backend.NewGrafanaCfg(settings)

	ua, err := useragent.New(p.cfg.BuildVersion, runtime.GOOS, runtime.GOARCH)
	if err != nil {
		p.logger.Warn("Could not create user agent", "error", err)
	}
	pCtx.UserAgent = ua

	return pCtx
}
