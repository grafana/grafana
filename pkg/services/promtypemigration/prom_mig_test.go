package promtypemigration

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

// Mocks

type mockPluginRegistry struct {
	installed bool
}

func (m *mockPluginRegistry) Plugin(ctx context.Context, id string, _ string) (*plugins.Plugin, bool) {
	if m.installed {
		return &plugins.Plugin{}, true
	}
	return &plugins.Plugin{}, false
}
func (m *mockPluginRegistry) Plugins(ctx context.Context) []*plugins.Plugin         { return nil }
func (m *mockPluginRegistry) Add(ctx context.Context, plugin *plugins.Plugin) error { return nil }
func (m *mockPluginRegistry) Remove(ctx context.Context, id, version string) error  { return nil }

type mockPluginInstaller struct {
	addCalled bool
	addErr    error
}

func (m *mockPluginInstaller) Add(ctx context.Context, pluginID, version string, opts plugins.AddOpts) error {
	m.addCalled = true
	return m.addErr
}
func (m *mockPluginInstaller) Remove(ctx context.Context, pluginID, version string) error {
	return nil
}

type mockDataSourcesService struct {
	datasources.DataSourceService
	dataSources []*datasources.DataSource
	err         error
}

func (m *mockDataSourcesService) DecryptedValues(ctx context.Context, ds *datasources.DataSource) (map[string]string, error) {
	return map[string]string{}, nil
}

func (m *mockDataSourcesService) UpdateDataSource(ctx context.Context, cmd *datasources.UpdateDataSourceCommand) (*datasources.DataSource, error) {
	return &datasources.DataSource{}, m.err
}

func (m *mockDataSourcesService) GetDataSourcesByType(ctx context.Context, query *datasources.GetDataSourcesByTypeQuery) ([]*datasources.DataSource, error) {
	return m.dataSources, m.err
}

// Test cases

func TestApplyMigration_NoDataSources(t *testing.T) {
	svc := &promMigrationService{}
	err := svc.applyMigration(context.Background(), "prometheus", []*datasources.DataSource{})
	assert.NoError(t, err)
}

func TestApplyMigration_PluginAlreadyInstalled(t *testing.T) {
	ds := &datasources.DataSource{ID: 1, JsonData: simplejson.New()}
	svc := &promMigrationService{
		cfg:                &setting.Cfg{BuildVersion: "1.0"},
		dataSourcesService: &mockDataSourcesService{},
		pluginRegistry:     &mockPluginRegistry{installed: true},
		pluginInstaller:    &mockPluginInstaller{},
	}
	err := svc.applyMigration(context.Background(), "prometheus", []*datasources.DataSource{ds})
	assert.NoError(t, err)
}

func TestApplyMigration_PluginNotInstalled_InstallSucceeds(t *testing.T) {
	ds := &datasources.DataSource{ID: 1, JsonData: simplejson.New()}
	installer := &mockPluginInstaller{}
	svc := &promMigrationService{
		cfg:                &setting.Cfg{BuildVersion: "1.0"},
		dataSourcesService: &mockDataSourcesService{},
		pluginRegistry:     &mockPluginRegistry{installed: false},
		pluginInstaller:    installer,
	}
	err := svc.applyMigration(context.Background(), "prometheus", []*datasources.DataSource{ds})
	assert.NoError(t, err)
	assert.True(t, installer.addCalled)
}

func TestApplyMigration_PluginNotInstalled_InstallFails(t *testing.T) {
	ds := &datasources.DataSource{ID: 1}
	installer := &mockPluginInstaller{addErr: errors.New("install failed")}
	svc := &promMigrationService{
		cfg:                &setting.Cfg{BuildVersion: "1.0"},
		dataSourcesService: &mockDataSourcesService{},
		pluginRegistry:     &mockPluginRegistry{installed: false},
		pluginInstaller:    installer,
	}
	err := svc.applyMigration(context.Background(), "prometheus", []*datasources.DataSource{ds})
	assert.EqualError(t, err, "install failed")
}

func TestApplyMigration_UpdateDataSourceFails(t *testing.T) {
	ds := &datasources.DataSource{ID: 1, JsonData: simplejson.New()}
	dataSvc := &mockDataSourcesService{err: errors.New("update failed")}
	svc := &promMigrationService{
		cfg:                &setting.Cfg{BuildVersion: "1.0"},
		dataSourcesService: dataSvc,
		pluginRegistry:     &mockPluginRegistry{installed: true},
		pluginInstaller:    &mockPluginInstaller{},
	}
	err := svc.applyMigration(context.Background(), "prometheus", []*datasources.DataSource{ds})
	assert.EqualError(t, err, "update failed")
}
