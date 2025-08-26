package promtypemigration

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

type AmazonPromMigrationService struct {
	promMigrationService
}

func ProvideAmazonPromMigrationService(
	dataSourcesService datasources.DataSourceService,
	pluginStore pluginstore.Store,
	pluginRepo repo.Service,
	pluginInstaller plugins.Installer,
	cfg *setting.Cfg,
) *AmazonPromMigrationService {
	return &AmazonPromMigrationService{
		promMigrationService: promMigrationService{
			dataSourcesService: dataSourcesService,
			pluginStore:        pluginStore,
			pluginRepo:         pluginRepo,
			pluginInstaller:    pluginInstaller,
			cfg:                cfg,
		},
	}
}

func (s *AmazonPromMigrationService) getPrometheusDataSources(ctx context.Context) ([]*datasources.DataSource, error) {
	amazonPromDs := []*datasources.DataSource{}
	query := &datasources.GetDataSourcesByTypeQuery{
		Type: datasources.DS_PROMETHEUS,
	}
	dsList, err := s.dataSourcesService.GetDataSourcesByType(ctx, query)
	if err != nil {
		return nil, err
	}
	for _, ds := range dsList {
		if sigV4Auth, found := ds.JsonData.CheckGet("sigV4Auth"); found {
			if enabled, err := sigV4Auth.Bool(); err != nil || !enabled {
				continue
			}
			amazonPromDs = append(amazonPromDs, ds)
			continue
		}
	}
	return amazonPromDs, nil
}

func (s *AmazonPromMigrationService) Migrate(ctx context.Context) error {
	pds, err := s.getPrometheusDataSources(ctx)
	if err != nil {
		return err
	}
	return s.applyMigration(ctx, "grafana-amazonprometheus-datasource", pds)
}
