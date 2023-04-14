package plugins

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

// Provision scans a directory for provisioning config files
// and provisions the app in those files.
func Provision(ctx context.Context, configDirectory string, pluginStore plugins.Store, pluginSettings pluginsettings.Service, orgService org.Service) error {
	logger := log.New("provisioning.plugins")
	ap := PluginProvisioner{
		log:            logger,
		cfgProvider:    newConfigReader(logger, pluginStore),
		pluginSettings: pluginSettings,
		orgService:     orgService,
	}
	return ap.applyChanges(ctx, configDirectory)
}

// PluginProvisioner is responsible for provisioning apps based on
// configuration read by the `configReader`
type PluginProvisioner struct {
	log            log.Logger
	cfgProvider    configReader
	pluginSettings pluginsettings.Service
	orgService     org.Service
}

func (ap *PluginProvisioner) apply(ctx context.Context, cfg *pluginsAsConfig) error {
	for _, app := range cfg.Apps {
		if app.OrgID == 0 && app.OrgName != "" {
			getOrgQuery := &org.GetOrgByNameQuery{Name: app.OrgName}
			res, err := ap.orgService.GetByName(ctx, getOrgQuery)
			if err != nil {
				return err
			}
			app.OrgID = res.ID
		} else if app.OrgID < 0 {
			app.OrgID = 1
		}

		ps, err := ap.pluginSettings.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{
			OrgID:    app.OrgID,
			PluginID: app.PluginID,
		})
		if err != nil {
			if !errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
				return err
			}
		} else {
			app.PluginVersion = ps.PluginVersion
		}

		ap.log.Info("Updating app from configuration ", "type", app.PluginID, "enabled", app.Enabled)
		if err := ap.pluginSettings.UpdatePluginSetting(ctx, &pluginsettings.UpdateArgs{
			OrgID:          app.OrgID,
			PluginID:       app.PluginID,
			Enabled:        app.Enabled,
			Pinned:         app.Pinned,
			JSONData:       app.JSONData,
			SecureJSONData: app.SecureJSONData,
			PluginVersion:  app.PluginVersion,
		}); err != nil {
			return err
		}
	}

	return nil
}

func (ap *PluginProvisioner) applyChanges(ctx context.Context, configPath string) error {
	configs, err := ap.cfgProvider.readConfig(ctx, configPath)
	if err != nil {
		return err
	}

	for _, cfg := range configs {
		if err := ap.apply(ctx, cfg); err != nil {
			return err
		}
	}

	return nil
}
