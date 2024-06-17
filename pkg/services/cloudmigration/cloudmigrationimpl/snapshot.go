package cloudmigrationimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
)

func (s *Service) getMigrationDataJSON(ctx context.Context) (*cloudmigration.MigrateDataRequest, error) {
	var migrationDataSlice []cloudmigration.MigrateDataRequestItem
	// Data sources
	dataSources, err := s.getDataSources(ctx)
	if err != nil {
		s.log.Error("Failed to get datasources", "err", err)
		return nil, err
	}
	for _, ds := range dataSources {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.DatasourceDataType,
			RefID: ds.UID,
			Name:  ds.Name,
			Data:  ds,
		})
	}

	// Dashboards
	dashboards, err := s.getDashboards(ctx)
	if err != nil {
		s.log.Error("Failed to get dashboards", "err", err)
		return nil, err
	}

	for _, dashboard := range dashboards {
		dashboard.Data.Del("id")
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.DashboardDataType,
			RefID: dashboard.UID,
			Name:  dashboard.Title,
			Data:  map[string]any{"dashboard": dashboard.Data},
		})
	}

	// Folders
	folders, err := s.getFolders(ctx)
	if err != nil {
		s.log.Error("Failed to get folders", "err", err)
		return nil, err
	}

	for _, f := range folders {
		migrationDataSlice = append(migrationDataSlice, cloudmigration.MigrateDataRequestItem{
			Type:  cloudmigration.FolderDataType,
			RefID: f.UID,
			Name:  f.Title,
			Data:  f,
		})
	}
	migrationData := &cloudmigration.MigrateDataRequest{
		Items: migrationDataSlice,
	}

	return migrationData, nil
}

func (s *Service) getDataSources(ctx context.Context) ([]datasources.AddDataSourceCommand, error) {
	dataSources, err := s.dsService.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{})
	if err != nil {
		s.log.Error("Failed to get all datasources", "err", err)
		return nil, err
	}

	result := []datasources.AddDataSourceCommand{}
	for _, dataSource := range dataSources {
		// Decrypt secure json to send raw credentials
		decryptedData, err := s.secretsService.DecryptJsonData(ctx, dataSource.SecureJsonData)
		if err != nil {
			s.log.Error("Failed to decrypt secure json data", "err", err)
			return nil, err
		}
		dataSourceCmd := datasources.AddDataSourceCommand{
			OrgID:           dataSource.OrgID,
			Name:            dataSource.Name,
			Type:            dataSource.Type,
			Access:          dataSource.Access,
			URL:             dataSource.URL,
			User:            dataSource.User,
			Database:        dataSource.Database,
			BasicAuth:       dataSource.BasicAuth,
			BasicAuthUser:   dataSource.BasicAuthUser,
			WithCredentials: dataSource.WithCredentials,
			IsDefault:       dataSource.IsDefault,
			JsonData:        dataSource.JsonData,
			SecureJsonData:  decryptedData,
			ReadOnly:        dataSource.ReadOnly,
			UID:             dataSource.UID,
		}
		result = append(result, dataSourceCmd)
	}
	return result, err
}

func (s *Service) getFolders(ctx context.Context) ([]folder.Folder, error) {
	reqCtx := contexthandler.FromContext(ctx)
	folders, err := s.folderService.GetFolders(ctx, folder.GetFoldersQuery{
		SignedInUser: reqCtx.SignedInUser,
	})
	if err != nil {
		return nil, err
	}

	var result []folder.Folder
	for _, folder := range folders {
		result = append(result, *folder)
	}

	return result, nil
}

func (s *Service) getDashboards(ctx context.Context) ([]dashboards.Dashboard, error) {
	dashs, err := s.dashboardService.GetAllDashboards(ctx)
	if err != nil {
		return nil, err
	}

	var result []dashboards.Dashboard
	for _, dashboard := range dashs {
		result = append(result, *dashboard)
	}
	return result, nil
}

func (s *Service) buildSnapshot(ctx context.Context, snapshot cloudmigration.CloudMigrationSnapshot) {

}
