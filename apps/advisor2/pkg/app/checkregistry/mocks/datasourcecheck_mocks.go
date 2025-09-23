package mocks

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// Mocks for datasource checks

type mockPluginContextProvider struct {
}

// ACTUALLY USED by datasourcecheck
func (m *mockPluginContextProvider) GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error) {
	// Create a plugin context with sample data based on the datasource
	pluginContext := backend.PluginContext{
		PluginID:      pluginID,
		PluginVersion: "1.0.0",
		OrgID:         1,
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			ID:   ds.ID,
			UID:  ds.UID,
			Name: ds.Name,
			URL:  ds.URL,
			JSONData: []byte(`{
				"httpMethod": "GET",
				"timeout": "30s",
				"keepCookies": []
			}`),
			DecryptedSecureJSONData: map[string]string{
				"password": "sample-password",
				"apiKey":   "sample-api-key",
			},
		},
		GrafanaConfig: backend.NewGrafanaCfg(map[string]string{
			"app_url":          "http://localhost:3000",
			"default_timezone": "UTC",
		}),
	}

	// Add user context if provided
	if user != nil && !user.IsNil() {
		pluginContext.User = &backend.User{
			Login: user.GetLogin(),
			Name:  user.GetName(),
			Email: user.GetEmail(),
			Role:  string(user.GetOrgRole()),
		}
	}

	return pluginContext, nil
}

type mockPluginClient struct {
	plugins.Client
}

type mockDataSourceService struct {
	datasources.DataSourceService
}

// ACTUALLY USED by datasourcecheck
func (m *mockDataSourceService) GetAllDataSources(ctx context.Context, query *datasources.GetAllDataSourcesQuery) ([]*datasources.DataSource, error) {
	return []*datasources.DataSource{
		{
			ID:   1,
			UID:  "prometheus-uid",
			Name: "Prometheus",
			Type: "prometheus",
			URL:  "http://localhost:9090",
		},
		{
			ID:   2,
			UID:  "mysql-uid",
			Name: "MySQL",
			Type: "mysql",
			URL:  "localhost:3306",
		},
		{
			ID:   3,
			UID:  "unknown-plugin-uid",
			Name: "Unknown Plugin DS",
			Type: "unknown-plugin-type",
			URL:  "http://localhost:8080",
		},
	}, nil
}

// ACTUALLY USED by datasourcecheck
func (m *mockDataSourceService) GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error) {
	// Return datasource based on UID
	switch query.UID {
	case "prometheus-uid":
		return &datasources.DataSource{
			ID:   1,
			UID:  "prometheus-uid",
			Name: "Prometheus",
			Type: "prometheus",
			URL:  "http://localhost:9090",
		}, nil
	case "mysql-uid":
		return &datasources.DataSource{
			ID:   2,
			UID:  "mysql-uid",
			Name: "MySQL",
			Type: "mysql",
			URL:  "localhost:3306",
		}, nil
	case "unknown-plugin-uid":
		return &datasources.DataSource{
			ID:   3,
			UID:  "unknown-plugin-uid",
			Name: "Unknown Plugin DS",
			Type: "unknown-plugin-type",
			URL:  "http://localhost:8080",
		}, nil
	default:
		return nil, nil
	}
}
