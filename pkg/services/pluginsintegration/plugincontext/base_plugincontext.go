package plugincontext

import (
	"context"
	"runtime"

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

func ProvideBaseService(settingsProvider setting.SettingsProvider, pluginRequestConfigProvider pluginconfig.PluginRequestConfigProvider) *BaseProvider {
	return newBaseProvider(settingsProvider, pluginRequestConfigProvider)
}

func newBaseProvider(settingsProvider setting.SettingsProvider, pluginRequestConfigProvider pluginconfig.PluginRequestConfigProvider) *BaseProvider {
	return &BaseProvider{
		settingsProvider:            settingsProvider,
		pluginRequestConfigProvider: pluginRequestConfigProvider,
		logger:                      log.New("base.plugin.context"),
	}
}

type BaseProvider struct {
	settingsProvider            setting.SettingsProvider
	pluginRequestConfigProvider pluginconfig.PluginRequestConfigProvider
	logger                      log.Logger
}

func (p *BaseProvider) GetBasePluginContext(ctx context.Context, plugin pluginstore.Plugin, user identity.Requester) backend.PluginContext {
	pCtx := backend.PluginContext{
		PluginID:      plugin.ID,
		PluginVersion: plugin.Info.Version,
	}
	if user != nil && !user.IsNil() {
		pCtx.OrgID = user.GetOrgID()
		pCtx.User = adapters.BackendUserFromSignedInUser(user)
	}

	settings := p.pluginRequestConfigProvider.PluginRequestConfig(ctx, plugin.ID, plugin.ExternalService)
	pCtx.GrafanaConfig = backend.NewGrafanaCfg(settings)

	cfg := p.settingsProvider.Get()
	ua, err := useragent.New(cfg.BuildVersion, runtime.GOOS, runtime.GOARCH)
	if err != nil {
		p.logger.Warn("Could not create user agent", "error", err)
	}
	pCtx.UserAgent = ua

	return pCtx
}
