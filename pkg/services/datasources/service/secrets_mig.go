package service

import (
	"context"

	"github.com/grafana/grafana/pkg/services/datasources"
)

type DataSourceSecretMigrationService struct {
	dataSourcesService datasources.DataSourceService
}

func ProvideDataSourceMigrationService(dataSourcesService datasources.DataSourceService) *DataSourceSecretMigrationService {
	return &DataSourceSecretMigrationService{
		dataSourcesService: dataSourcesService,
	}
}

func (s *DataSourceSecretMigrationService) Migrate(ctx context.Context) error {
	query := &datasources.GetAllDataSourcesQuery{}
	err := s.dataSourcesService.GetAllDataSources(ctx, query)
	if err != nil {
		return err
	}

	for _, ds := range query.Result {
		hasMigration := ds.JsonData.Get("secretMigrationComplete").MustBool()
		if !hasMigration {
			secureJsonData, err := s.dataSourcesService.DecryptedValues(ctx, ds)
			if err != nil {
				return err
			}

			ds.JsonData.Set("secretMigrationComplete", true)

			// Secrets are set by the update data source function if the SecureJsonData is set in the command
			// Secrets are deleted by the update data source function if the disableSecretsCompatibility flag is enabled
			err = s.dataSourcesService.UpdateDataSource(ctx, &datasources.UpdateDataSourceCommand{
				Id:             ds.Id,
				OrgId:          ds.OrgId,
				Uid:            ds.Uid,
				Name:           ds.Name,
				JsonData:       ds.JsonData,
				SecureJsonData: secureJsonData,

				// These are needed by the SQL function due to UseBool and MustCols
				IsDefault:       ds.IsDefault,
				BasicAuth:       ds.BasicAuth,
				WithCredentials: ds.WithCredentials,
				ReadOnly:        ds.ReadOnly,
				User:            ds.User,
			})
			if err != nil {
				return err
			}
		}
	}

	return nil
}
