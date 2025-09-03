package promtypemigration

import (
	"context"
	"fmt"
	"runtime"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
)

type PromMigrationHandler interface {
	Migrate(context.Context, *promMigrationService) error
}

type promMigrationService struct {
	cfg                *setting.Cfg
	dataSourcesService datasources.DataSourceService
	pluginRegistry     registry.Service
	pluginRepo         repo.Service
	pluginInstaller    plugins.Installer
}

func (s *promMigrationService) applyMigration(ctx context.Context, pluginID string, promDataSources []*datasources.DataSource) error {
	if len(promDataSources) == 0 {
		return nil
	}

	// check to see if prom is installed, if not install it
	if _, installed := s.pluginRegistry.Plugin(ctx, pluginID, ""); !installed {
		compatOpts := plugins.NewAddOpts(s.cfg.BuildVersion, runtime.GOOS, runtime.GOARCH, "")
		err := s.pluginInstaller.Add(ctx, pluginID, "", compatOpts)
		if err != nil {
			return err
		}
	}

	logger.Debug("performing prometheus data source type migration", "plugin", pluginID)

	for _, ds := range promDataSources {
		err := s.updateDataSourceType(ctx, ds, pluginID)
		if err != nil {
			return err
		}
	}

	logger.Debug("prometheus data source type migration complete", "plugin", pluginID)

	return nil
}

func (s *promMigrationService) updateDataSourceType(ctx context.Context, ds *datasources.DataSource, newType string) error {
	secureJsonData, err := s.dataSourcesService.DecryptedValues(ctx, ds)
	if err != nil {
		return err
	}
	if ds.JsonData == nil {
		return fmt.Errorf("no JsonData found for data source ID %d", ds.ID)
	}
	ds.JsonData.Set("prometheus-type-migration", true)
	_, err = s.dataSourcesService.UpdateDataSource(ctx, &datasources.UpdateDataSourceCommand{
		ID:             ds.ID,
		Type:           newType,
		OrgID:          ds.OrgID,
		UID:            ds.UID,
		Name:           ds.Name,
		JsonData:       ds.JsonData,
		SecureJsonData: secureJsonData,

		// These are needed by the SQL function due to UseBool and MustCols
		IsDefault:       ds.IsDefault,
		BasicAuth:       ds.BasicAuth,
		WithCredentials: ds.WithCredentials,
		ReadOnly:        ds.ReadOnly,
		User:            ds.User,
		Database:        ds.Database,
	})
	return err
}
