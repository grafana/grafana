package migration

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	dataSourceSecretType = "datasource"
)

type DataSourceSecretMigrationService struct {
	sqlStore           *sqlstore.SQLStore
	dataSourcesService datasources.DataSourceService
	secretsStore       kvstore.SecretsKVStore
	features           featuremgmt.FeatureToggles
	log                log.Logger
}

func ProvideDataSourceMigrationService(
	cfg *setting.Cfg, dataSourcesService datasources.DataSourceService,
	secretsStore kvstore.SecretsKVStore, features featuremgmt.FeatureToggles,
	sqlStore *sqlstore.SQLStore,
) kvstore.SecretMigrationService {
	return &DataSourceSecretMigrationService{
		sqlStore:           sqlStore,
		dataSourcesService: dataSourcesService,
		secretsStore:       secretsStore,
		features:           features,
		log:                log.New("secret.migration"),
	}
}

func (s *DataSourceSecretMigrationService) Run(ctx context.Context) error {
	return s.sqlStore.InTransaction(ctx, func(ctx context.Context) error {
		query := &models.GetDataSourcesQuery{}
		err := s.dataSourcesService.GetDataSources(ctx, query)
		if err != nil {
			return err
		}

		s.log.Debug("starting data source secret migration")
		for _, ds := range query.Result {
			hasMigration, _ := ds.JsonData.Get("secretMigrationComplete").Bool()
			if !hasMigration {
				secureJsonData, err := s.dataSourcesService.DecryptLegacySecrets(ctx, ds)
				if err != nil {
					return err
				}

				jsonData, err := json.Marshal(secureJsonData)
				if err != nil {
					return err
				}

				err = s.secretsStore.Set(ctx, ds.OrgId, ds.Name, dataSourceSecretType, string(jsonData))
				if err != nil {
					return err
				}

				ds.JsonData.Set("secretMigrationComplete", true)
				err = s.dataSourcesService.UpdateDataSource(ctx, &models.UpdateDataSourceCommand{Id: ds.Id, OrgId: ds.OrgId, Uid: ds.Uid, JsonData: ds.JsonData})
				if err != nil {
					return err
				}
			}

			if s.features.IsEnabled(featuremgmt.FlagDisableSecretsCompatibility) && len(ds.SecureJsonData) > 0 {
				err := s.dataSourcesService.DeleteDataSourceSecrets(ctx, &models.DeleteDataSourceSecretsCommand{UID: ds.Uid, OrgID: ds.OrgId, ID: ds.Id})
				if err != nil {
					return err
				}
			}
		}
		s.log.Debug("data source secret migration complete")
		return nil
	})
}
