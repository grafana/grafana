package mocksvcs

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type PluginContextProvider struct {
}

// ACTUALLY USED by datasourcecheck
func (m *PluginContextProvider) GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error) {
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
