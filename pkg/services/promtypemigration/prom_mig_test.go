package promtypemigration

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

// Mocks

type mockPluginStore struct {
	pluginstore.Store
	installed bool
}

func (m *mockPluginStore) Plugin(ctx context.Context, id string) (pluginstore.Plugin, bool) {
	if m.installed {
		return pluginstore.Plugin{}, true
	}
	return pluginstore.Plugin{}, false
}

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
		pluginStore:        &mockPluginStore{installed: true},
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
		pluginStore:        &mockPluginStore{installed: false},
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
		pluginStore:        &mockPluginStore{installed: false},
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
		pluginStore:        &mockPluginStore{installed: true},
		pluginInstaller:    &mockPluginInstaller{},
	}
	err := svc.applyMigration(context.Background(), "prometheus", []*datasources.DataSource{ds})
	assert.EqualError(t, err, "update failed")
}
