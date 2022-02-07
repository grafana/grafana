package plugins

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

type Store interface {
	GetOrgByNameHandler(ctx context.Context, query *models.GetOrgByNameQuery) error
	GetPluginSettingById(ctx context.Context, query *models.GetPluginSettingByIdQuery) error
	UpdatePluginSetting(ctx context.Context, cmd *models.UpdatePluginSettingCmd) error
}

// Provision scans a directory for provisioning config files
// and provisions the app in those files.
func Provision(ctx context.Context, configDirectory string, store Store, pluginStore plugins.Store) error {
	logger := log.New("provisioning.plugins")
	ap := PluginProvisioner{
		log:         logger,
		cfgProvider: newConfigReader(logger, pluginStore),
		store:       store,
	}
	return ap.applyChanges(ctx, configDirectory)
}

// PluginProvisioner is responsible for provisioning apps based on
// configuration read by the `configReader`
type PluginProvisioner struct {
	log         log.Logger
	cfgProvider configReader
	store       Store
}

func (ap *PluginProvisioner) apply(ctx context.Context, cfg *pluginsAsConfig) error {
	for _, app := range cfg.Apps {
		if app.OrgID == 0 && app.OrgName != "" {
			getOrgQuery := &models.GetOrgByNameQuery{Name: app.OrgName}
			if err := ap.store.GetOrgByNameHandler(ctx, getOrgQuery); err != nil {
				return err
			}
			app.OrgID = getOrgQuery.Result.Id
		} else if app.OrgID < 0 {
			app.OrgID = 1
		}

		query := &models.GetPluginSettingByIdQuery{OrgId: app.OrgID, PluginId: app.PluginID}
		err := ap.store.GetPluginSettingById(ctx, query)
		if err != nil {
			if !errors.Is(err, models.ErrPluginSettingNotFound) {
				return err
			}
		} else {
			app.PluginVersion = query.Result.PluginVersion
		}

		ap.log.Info("Updating app from configuration ", "type", app.PluginID, "enabled", app.Enabled)
		cmd := &models.UpdatePluginSettingCmd{
			OrgId:          app.OrgID,
			PluginId:       app.PluginID,
			Enabled:        app.Enabled,
			Pinned:         app.Pinned,
			JsonData:       app.JSONData,
			SecureJsonData: app.SecureJSONData,
			PluginVersion:  app.PluginVersion,
		}
		if err := ap.store.UpdatePluginSetting(ctx, cmd); err != nil {
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
