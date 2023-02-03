package datasources

import (
	"context"
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type FakeDataSourceService struct {
	lastID                int64
	DataSources           []*datasources.DataSource
	SimulatePluginFailure bool
}

var _ datasources.DataSourceService = &FakeDataSourceService{}

func (s *FakeDataSourceService) GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) error {
	for _, datasource := range s.DataSources {
		idMatch := query.ID != 0 && query.ID == datasource.ID
		uidMatch := query.UID != "" && query.UID == datasource.UID
		nameMatch := query.Name != "" && query.Name == datasource.Name
		if idMatch || nameMatch || uidMatch {
			query.Result = datasource

			return nil
		}
	}
	return datasources.ErrDataSourceNotFound
}

func (s *FakeDataSourceService) GetDataSources(ctx context.Context, query *datasources.GetDataSourcesQuery) error {
	for _, datasource := range s.DataSources {
		orgMatch := query.OrgID != 0 && query.OrgID == datasource.OrgID
		if orgMatch {
			query.Result = append(query.Result, datasource)
		}
	}
	return nil
}

func (s *FakeDataSourceService) GetAllDataSources(ctx context.Context, query *datasources.GetAllDataSourcesQuery) error {
	query.Result = s.DataSources
	return nil
}

func (s *FakeDataSourceService) GetDataSourcesByType(ctx context.Context, query *datasources.GetDataSourcesByTypeQuery) error {
	for _, datasource := range s.DataSources {
		if query.OrgID > 0 && datasource.OrgID != query.OrgID {
			continue
		}
		typeMatch := query.Type != "" && query.Type == datasource.Type
		if typeMatch {
			query.Result = append(query.Result, datasource)
		}
	}
	return nil
}

func (s *FakeDataSourceService) AddDataSource(ctx context.Context, cmd *datasources.AddDataSourceCommand) error {
	if s.lastID == 0 {
		s.lastID = int64(len(s.DataSources) - 1)
	}
	cmd.Result = &datasources.DataSource{
		ID:    s.lastID + 1,
		Name:  cmd.Name,
		Type:  cmd.Type,
		UID:   cmd.UID,
		OrgID: cmd.OrgID,
	}
	s.DataSources = append(s.DataSources, cmd.Result)
	return nil
}

func (s *FakeDataSourceService) DeleteDataSource(ctx context.Context, cmd *datasources.DeleteDataSourceCommand) error {
	for i, datasource := range s.DataSources {
		idMatch := cmd.ID != 0 && cmd.ID == datasource.ID
		uidMatch := cmd.UID != "" && cmd.UID == datasource.UID
		nameMatch := cmd.Name != "" && cmd.Name == datasource.Name
		if idMatch || nameMatch || uidMatch {
			s.DataSources = append(s.DataSources[:i], s.DataSources[i+1:]...)
			return nil
		}
	}
	return datasources.ErrDataSourceNotFound
}

func (s *FakeDataSourceService) UpdateDataSource(ctx context.Context, cmd *datasources.UpdateDataSourceCommand) error {
	for _, datasource := range s.DataSources {
		idMatch := cmd.ID != 0 && cmd.ID == datasource.ID
		uidMatch := cmd.UID != "" && cmd.UID == datasource.UID
		nameMatch := cmd.Name != "" && cmd.Name == datasource.Name
		if idMatch || nameMatch || uidMatch {
			if cmd.Name != "" {
				datasource.Name = cmd.Name
			}
			return nil
		}
	}
	return datasources.ErrDataSourceNotFound
}

func (s *FakeDataSourceService) GetDefaultDataSource(ctx context.Context, query *datasources.GetDefaultDataSourceQuery) error {
	return nil
}

func (s *FakeDataSourceService) GetHTTPTransport(ctx context.Context, ds *datasources.DataSource, provider httpclient.Provider, customMiddlewares ...sdkhttpclient.Middleware) (http.RoundTripper, error) {
	rt, err := provider.GetTransport(sdkhttpclient.Options{})
	if err != nil {
		return nil, err
	}
	return rt, nil
}

func (s *FakeDataSourceService) DecryptedValues(ctx context.Context, ds *datasources.DataSource) (map[string]string, error) {
	if s.SimulatePluginFailure {
		return nil, datasources.ErrDatasourceSecretsPluginUserFriendly{Err: "unknown error"}
	}
	values := make(map[string]string)
	return values, nil
}

func (s *FakeDataSourceService) DecryptedValue(ctx context.Context, ds *datasources.DataSource, key string) (string, bool, error) {
	return "", false, nil
}

func (s *FakeDataSourceService) DecryptedBasicAuthPassword(ctx context.Context, ds *datasources.DataSource) (string, error) {
	return "", nil
}

func (s *FakeDataSourceService) DecryptedPassword(ctx context.Context, ds *datasources.DataSource) (string, error) {
	return "", nil
}
