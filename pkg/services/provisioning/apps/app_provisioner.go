package apps

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

// Provision scans a directory for provisioning config files
// and provisions the app in those files.
func Provision(configDirectory string) error {
	ap := newAppProvisioner(log.New("provisioning.apps"))
	return ap.applyChanges(configDirectory)
}

// AppProvisioner is responsible for provisioning apps based on
// configuration read by the `configReader`
type AppProvisioner struct {
	log         log.Logger
	cfgProvider configReader
}

func newAppProvisioner(log log.Logger) AppProvisioner {
	return AppProvisioner{
		log:         log,
		cfgProvider: newConfigReader(log),
	}
}

func (ap *AppProvisioner) apply(cfg *appsAsConfig) error {
	for _, app := range cfg.Apps {
		if app.OrgID == 0 && app.OrgName != "" {
			getOrgQuery := &models.GetOrgByNameQuery{Name: app.OrgName}
			if err := bus.Dispatch(getOrgQuery); err != nil {
				return err
			}
			app.OrgID = getOrgQuery.Result.Id
		} else if app.OrgID < 0 {
			app.OrgID = 1
		}

		query := &models.GetPluginSettingByIdQuery{OrgId: app.OrgID, PluginId: app.PluginID}
		err := bus.Dispatch(query)
		if err != nil {
			if err != models.ErrPluginSettingNotFound {
				return err
			}
		} else {
			app.PluginVersion = query.Result.PluginVersion
			app.Pinned = query.Result.Pinned
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
		if err := bus.Dispatch(cmd); err != nil {
			return err
		}
	}

	return nil
}

func (ap *AppProvisioner) applyChanges(configPath string) error {
	configs, err := ap.cfgProvider.readConfig(configPath)
	if err != nil {
		return err
	}

	for _, cfg := range configs {
		if err := ap.apply(cfg); err != nil {
			return err
		}
	}

	return nil
}
