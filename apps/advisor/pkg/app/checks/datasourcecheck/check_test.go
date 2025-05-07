package datasourcecheck

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/assert"
)

// runChecks executes all steps for all items and returns the failures
func runChecks(check *check) ([]advisor.CheckReportFailure, error) {
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{})
	items, err := check.Items(ctx)
	if err != nil {
		return nil, err
	}

	failures := []advisor.CheckReportFailure{}
	for _, step := range check.Steps() {
		for _, item := range items {
			stepFailures, err := step.Run(ctx, logging.DefaultLogger, &advisor.CheckSpec{}, item)
			if err != nil {
				return nil, err
			}
			if stepFailures != nil {
				failures = append(failures, *stepFailures)
			}
		}
	}

	return failures, nil
}

func TestCheck_Run(t *testing.T) {
	t.Run("should return no failures when all datasources are healthy", func(t *testing.T) {
		datasources := []*datasources.DataSource{
			{UID: "valid-uid-1", Type: "prometheus", Name: "Prometheus"},
			{UID: "valid-uid-2", Type: "mysql", Name: "MySQL"},
		}

		mockDatasourceSvc := &MockDatasourceSvc{dss: datasources}
		mockPluginContextProvider := &MockPluginContextProvider{pCtx: backend.PluginContext{}}
		mockPluginClient := &MockPluginClient{res: &backend.CheckHealthResult{Status: backend.HealthStatusOk}}
		mockPluginRepo := &MockPluginRepo{exists: true}
		mockPluginStore := &MockPluginStore{exists: true}

		check := &check{
			DatasourceSvc:         mockDatasourceSvc,
			PluginContextProvider: mockPluginContextProvider,
			PluginClient:          mockPluginClient,
			PluginRepo:            mockPluginRepo,
			PluginStore:           mockPluginStore,
		}

		failures, err := runChecks(check)
		assert.NoError(t, err)
		assert.Empty(t, failures)
	})

	t.Run("should return failures when datasource UID is invalid", func(t *testing.T) {
		datasources := []*datasources.DataSource{
			{UID: "invalid uid", Type: "prometheus", Name: "Prometheus"},
		}

		mockDatasourceSvc := &MockDatasourceSvc{dss: datasources}
		mockPluginContextProvider := &MockPluginContextProvider{pCtx: backend.PluginContext{}}
		mockPluginClient := &MockPluginClient{res: &backend.CheckHealthResult{Status: backend.HealthStatusOk}}
		mockPluginRepo := &MockPluginRepo{exists: true}
		mockPluginStore := &MockPluginStore{exists: true}

		check := &check{
			DatasourceSvc:         mockDatasourceSvc,
			PluginContextProvider: mockPluginContextProvider,
			PluginClient:          mockPluginClient,
			PluginRepo:            mockPluginRepo,
			PluginStore:           mockPluginStore,
		}

		failures, err := runChecks(check)
		assert.NoError(t, err)
		assert.Len(t, failures, 1)
		assert.Equal(t, "uid-validation", failures[0].StepID)
	})

	t.Run("should return failures when datasource health check fails", func(t *testing.T) {
		datasources := []*datasources.DataSource{
			{UID: "valid-uid-1", Type: "prometheus", Name: "Prometheus"},
		}

		mockDatasourceSvc := &MockDatasourceSvc{dss: datasources}
		mockPluginContextProvider := &MockPluginContextProvider{pCtx: backend.PluginContext{}}
		mockPluginClient := &MockPluginClient{res: &backend.CheckHealthResult{Status: backend.HealthStatusError}}
		mockPluginRepo := &MockPluginRepo{exists: true}
		mockPluginStore := &MockPluginStore{exists: true}

		check := &check{
			DatasourceSvc:         mockDatasourceSvc,
			PluginContextProvider: mockPluginContextProvider,
			PluginClient:          mockPluginClient,
			PluginRepo:            mockPluginRepo,
			PluginStore:           mockPluginStore,
		}

		failures, err := runChecks(check)
		assert.NoError(t, err)
		assert.Len(t, failures, 1)
		assert.Equal(t, "health-check", failures[0].StepID)
	})

	t.Run("should skip health check when plugin does not support backend health checks", func(t *testing.T) {
		datasources := []*datasources.DataSource{
			{UID: "valid-uid-1", Type: "prometheus", Name: "Prometheus"},
		}
		mockDatasourceSvc := &MockDatasourceSvc{dss: datasources}
		mockPluginContextProvider := &MockPluginContextProvider{pCtx: backend.PluginContext{}}
		mockPluginClient := &MockPluginClient{err: plugins.ErrMethodNotImplemented}
		mockPluginRepo := &MockPluginRepo{exists: true}
		mockPluginStore := &MockPluginStore{exists: true}

		check := &check{
			DatasourceSvc:         mockDatasourceSvc,
			PluginContextProvider: mockPluginContextProvider,
			PluginClient:          mockPluginClient,
			PluginRepo:            mockPluginRepo,
			PluginStore:           mockPluginStore,
		}

		failures, err := runChecks(check)
		assert.NoError(t, err)
		assert.Empty(t, failures)
	})

	t.Run("should return failure when plugin is not installed", func(t *testing.T) {
		datasources := []*datasources.DataSource{
			{UID: "valid-uid-1", Type: "prometheus", Name: "Prometheus"},
		}
		mockDatasourceSvc := &MockDatasourceSvc{dss: datasources}
		mockPluginContextProvider := &MockPluginContextProvider{pCtx: backend.PluginContext{}}
		mockPluginClient := &MockPluginClient{err: plugins.ErrPluginNotRegistered}
		mockPluginRepo := &MockPluginRepo{exists: true}
		mockPluginStore := &MockPluginStore{exists: true}

		check := &check{
			DatasourceSvc:         mockDatasourceSvc,
			PluginContextProvider: mockPluginContextProvider,
			PluginClient:          mockPluginClient,
			PluginRepo:            mockPluginRepo,
			PluginStore:           mockPluginStore,
		}

		failures, err := runChecks(check)
		assert.NoError(t, err)
		assert.Len(t, failures, 1)
		assert.Equal(t, "health-check", failures[0].StepID)
	})

	t.Run("should return failure when plugin is not installed and the plugin is available in the repo", func(t *testing.T) {
		datasources := []*datasources.DataSource{
			{UID: "valid-uid-1", Type: "prometheus", Name: "Prometheus"},
		}
		mockDatasourceSvc := &MockDatasourceSvc{dss: datasources}
		mockPluginContextProvider := &MockPluginContextProvider{pCtx: backend.PluginContext{}}
		mockPluginClient := &MockPluginClient{res: &backend.CheckHealthResult{Status: backend.HealthStatusOk}}
		mockPluginRepo := &MockPluginRepo{exists: true}
		mockPluginStore := &MockPluginStore{exists: false}

		check := &check{
			DatasourceSvc:         mockDatasourceSvc,
			PluginContextProvider: mockPluginContextProvider,
			PluginClient:          mockPluginClient,
			PluginRepo:            mockPluginRepo,
			PluginStore:           mockPluginStore,
		}

		failures, err := runChecks(check)
		assert.NoError(t, err)
		assert.Len(t, failures, 1)
		assert.Equal(t, MissingPluginStepID, failures[0].StepID)
		assert.Len(t, failures[0].Links, 2)
	})

	t.Run("should return failure when plugin is not installed and the plugin is not available in the repo", func(t *testing.T) {
		datasources := []*datasources.DataSource{
			{UID: "valid-uid-1", Type: "prometheus", Name: "Prometheus"},
		}
		mockDatasourceSvc := &MockDatasourceSvc{dss: datasources}
		mockPluginContextProvider := &MockPluginContextProvider{pCtx: backend.PluginContext{}}
		mockPluginClient := &MockPluginClient{res: &backend.CheckHealthResult{Status: backend.HealthStatusOk}}
		mockPluginRepo := &MockPluginRepo{exists: false}
		mockPluginStore := &MockPluginStore{exists: false}

		check := &check{
			DatasourceSvc:         mockDatasourceSvc,
			PluginContextProvider: mockPluginContextProvider,
			PluginClient:          mockPluginClient,
			PluginRepo:            mockPluginRepo,
			PluginStore:           mockPluginStore,
		}

		failures, err := runChecks(check)
		assert.NoError(t, err)
		assert.Len(t, failures, 1)
		assert.Equal(t, MissingPluginStepID, failures[0].StepID)
		assert.Len(t, failures[0].Links, 1)
	})
}

type MockDatasourceSvc struct {
	datasources.DataSourceService

	dss []*datasources.DataSource
}

func (m *MockDatasourceSvc) GetAllDataSources(context.Context, *datasources.GetAllDataSourcesQuery) ([]*datasources.DataSource, error) {
	return m.dss, nil
}

type MockPluginContextProvider struct {
	pCtx backend.PluginContext
}

func (m *MockPluginContextProvider) GetWithDataSource(context.Context, string, identity.Requester, *datasources.DataSource) (backend.PluginContext, error) {
	return m.pCtx, nil
}

type MockPluginClient struct {
	plugins.Client

	res *backend.CheckHealthResult
	err error
}

func (m *MockPluginClient) CheckHealth(context.Context, *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return m.res, m.err
}

type MockPluginStore struct {
	pluginstore.Store

	exists bool
}

func (m *MockPluginStore) Plugin(context.Context, string) (pluginstore.Plugin, bool) {
	return pluginstore.Plugin{}, m.exists
}

type MockPluginRepo struct {
	repo.Service

	exists bool
}

func (m *MockPluginRepo) PluginInfo(context.Context, string) (*repo.PluginInfo, error) {
	if !m.exists {
		return nil, errors.New("plugin not found")
	}
	return &repo.PluginInfo{}, nil
}
