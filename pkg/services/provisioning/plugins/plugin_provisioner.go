package plugins

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

// Provision scans a directory for provisioning config files
// and provisions the app in those files.
func Provision(ctx context.Context, configDirectory string, pluginStore pluginstore.Store, pluginSettings pluginsettings.Service, orgService org.Service) error {
	logger := log.New("provisioning.plugins")
	ap := PluginProvisioner{
		log:            logger,
		cfgProvider:    newConfigReader(logger, pluginStore),
		pluginSettings: pluginSettings,
		orgService:     orgService,
		pluginStore:    pluginStore,
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
	pluginStore    pluginstore.Store
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

		p, found := ap.pluginStore.Plugin(ctx, app.PluginID)
		if !found {
			return errors.New("plugin not found")
		}
		if p.AutoEnabled && !app.Enabled {
			return errors.New("plugin is auto enabled and cannot be disabled")
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
