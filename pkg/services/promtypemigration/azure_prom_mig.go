package promtypemigration

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

type AzurePromMigrationService struct {
	promMigrationService
}

func ProvideAzurePromMigrationService(
	dataSourcesService datasources.DataSourceService,
	pluginStore pluginstore.Store,
	pluginRepo repo.Service,
	pluginInstaller plugins.Installer,
	cfg *setting.Cfg,
) *AzurePromMigrationService {
	return &AzurePromMigrationService{
		promMigrationService: promMigrationService{
			dataSourcesService: dataSourcesService,
			pluginStore:        pluginStore,
			pluginRepo:         pluginRepo,
			pluginInstaller:    pluginInstaller,
			cfg:                cfg,
		},
	}
}

func (s *AzurePromMigrationService) getPrometheusDataSources(ctx context.Context) ([]*datasources.DataSource, error) {
	azurePromDs := []*datasources.DataSource{}
	query := &datasources.GetDataSourcesByTypeQuery{
		Type: datasources.DS_PROMETHEUS,
	}
	dsList, err := s.dataSourcesService.GetDataSourcesByType(ctx, query)
	if err != nil {
		return nil, err
	}
	for _, ds := range dsList {
		if azureAuth, found := ds.JsonData.CheckGet("azureCredentials"); found {
			var val any
			if val, err = azureAuth.Value(); err != nil || val == nil {
				continue
			}
			azurePromDs = append(azurePromDs, ds)
			continue
		}
	}
	return azurePromDs, nil
}

func (s *AzurePromMigrationService) Migrate(ctx context.Context) error {
	pds, err := s.getPrometheusDataSources(ctx)
	if err != nil {
		return err
	}
	return s.promMigrationService.applyMigration(ctx, "grafana-azureprometheus-datasource", pds)
}
