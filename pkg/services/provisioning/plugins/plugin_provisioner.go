package plugins

import (
	"context"
	"errors"
	"fmt"

	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

// provisioningConcurrency bounds the fan-out for per-app provisioning.
// Kept small so backing DB + extsvc-account creation stay within pool limits.
const provisioningConcurrency = 8

var (
	ErrPluginProvisioningNotFound    = errors.New("plugin not found")
	ErrPluginProvisioningAutoEnabled = errors.New("plugin is auto enabled and cannot be disabled")
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

// applyApp provisions a single app. Each call is independent of siblings when
// the (OrgID, PluginID) pairs are distinct — which is enforced by the config
// schema (one app entry per plugin per config file).
func (ap *PluginProvisioner) applyApp(ctx context.Context, app *appFromConfig) error {
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
		return fmt.Errorf("%w: %s", ErrPluginProvisioningNotFound, app.PluginID)
	}
	if p.AutoEnabled && !app.Enabled {
		return fmt.Errorf("%w: %s", ErrPluginProvisioningAutoEnabled, app.PluginID)
	}

	ps, err := ap.pluginSettings.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{
		OrgID:    app.OrgID,
		PluginID: app.PluginID,
	})
	if err != nil {
		if !errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
			return fmt.Errorf("%w: %s", err, app.PluginID)
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
		return fmt.Errorf("%w: %s", err, app.PluginID)
	}
	return nil
}

func (ap *PluginProvisioner) applyChanges(ctx context.Context, configPath string) error {
	configs, err := ap.cfgProvider.readConfig(ctx, configPath)
	if err != nil {
		return err
	}

	// Flatten configs × apps into a single bounded errgroup. Each app
	// references a distinct (OrgID, PluginID) within the config set (duplicates
	// would be a user error that UpdatePluginSetting's upsert already tolerates
	// serially), so fan-out is safe.
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(provisioningConcurrency)

	for _, cfg := range configs {
		for _, app := range cfg.Apps {
			g.Go(func() error {
				return ap.applyApp(gctx, app)
			})
		}
	}
	return g.Wait()
}
