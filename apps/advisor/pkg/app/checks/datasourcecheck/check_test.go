package datasourcecheck

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/assert"
)

func TestCheck_Run(t *testing.T) {
	t.Run("should return no failures when all datasources are healthy", func(t *testing.T) {
		datasources := []*datasources.DataSource{
			{UID: "valid-uid-1", Type: "prometheus", Name: "Prometheus"},
			{UID: "valid-uid-2", Type: "mysql", Name: "MySQL"},
		}

		mockDatasourceSvc := &MockDatasourceSvc{dss: datasources}
		mockPluginContextProvider := &MockPluginContextProvider{pCtx: backend.PluginContext{}}
		mockPluginClient := &MockPluginClient{res: &backend.CheckHealthResult{Status: backend.HealthStatusOk}}

		check := &check{
			DatasourceSvc:         mockDatasourceSvc,
			PluginContextProvider: mockPluginContextProvider,
			PluginClient:          mockPluginClient,
			log:                   log.New("advisor.datasourcecheck"),
		}

		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{})
		items, err := check.Items(ctx)
		assert.NoError(t, err)
		failures := []advisor.CheckReportFailure{}
		for _, step := range check.Steps() {
			for _, item := range items {
				stepFailures, err := step.Run(ctx, &advisor.CheckSpec{}, item)
				assert.NoError(t, err)
				if stepFailures != nil {
					failures = append(failures, *stepFailures)
				}
			}
		}

		assert.NoError(t, err)
		assert.Equal(t, 2, len(items))
		assert.Empty(t, failures)
	})

	t.Run("should return failures when datasource UID is invalid", func(t *testing.T) {
		datasources := []*datasources.DataSource{
			{UID: "invalid uid", Type: "prometheus", Name: "Prometheus"},
		}

		mockDatasourceSvc := &MockDatasourceSvc{dss: datasources}
		mockPluginContextProvider := &MockPluginContextProvider{pCtx: backend.PluginContext{}}
		mockPluginClient := &MockPluginClient{res: &backend.CheckHealthResult{Status: backend.HealthStatusOk}}

		check := &check{
			DatasourceSvc:         mockDatasourceSvc,
			PluginContextProvider: mockPluginContextProvider,
			PluginClient:          mockPluginClient,
			log:                   log.New("advisor.datasourcecheck"),
		}

		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{})
		items, err := check.Items(ctx)
		assert.NoError(t, err)
		failures := []advisor.CheckReportFailure{}
		for _, step := range check.Steps() {
			for _, item := range items {
				stepFailures, err := step.Run(ctx, &advisor.CheckSpec{}, item)
				assert.NoError(t, err)
				if stepFailures != nil {
					failures = append(failures, *stepFailures)
				}
			}
		}

		assert.NoError(t, err)
		assert.Equal(t, 1, len(items))
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

		check := &check{
			DatasourceSvc:         mockDatasourceSvc,
			PluginContextProvider: mockPluginContextProvider,
			PluginClient:          mockPluginClient,
			log:                   log.New("advisor.datasourcecheck"),
		}

		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{})
		items, err := check.Items(ctx)
		assert.NoError(t, err)
		failures := []advisor.CheckReportFailure{}
		for _, step := range check.Steps() {
			for _, item := range items {
				stepFailures, err := step.Run(ctx, &advisor.CheckSpec{}, item)
				assert.NoError(t, err)
				if stepFailures != nil {
					failures = append(failures, *stepFailures)
				}
			}
		}

		assert.NoError(t, err)
		assert.Equal(t, 1, len(items))
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

		check := &check{
			DatasourceSvc:         mockDatasourceSvc,
			PluginContextProvider: mockPluginContextProvider,
			PluginClient:          mockPluginClient,
			log:                   log.New("advisor.datasourcecheck"),
		}

		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{})
		items, err := check.Items(ctx)
		assert.NoError(t, err)
		failures := []advisor.CheckReportFailure{}
		for _, step := range check.Steps() {
			for _, item := range items {
				stepFailures, err := step.Run(ctx, &advisor.CheckSpec{}, item)
				assert.NoError(t, err)
				if stepFailures != nil {
					failures = append(failures, *stepFailures)
				}
			}
		}

		assert.NoError(t, err)
		assert.Equal(t, 1, len(items))
		assert.Len(t, failures, 0)
	})
}

type MockDatasourceSvc struct {
	datasources.DataSourceService

	dss []*datasources.DataSource
}

func (m *MockDatasourceSvc) GetAllDataSources(ctx context.Context, query *datasources.GetAllDataSourcesQuery) ([]*datasources.DataSource, error) {
	return m.dss, nil
}

type MockPluginContextProvider struct {
	pCtx backend.PluginContext
}

func (m *MockPluginContextProvider) GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error) {
	return m.pCtx, nil
}

type MockPluginClient struct {
	plugins.Client

	res *backend.CheckHealthResult
	err error
}

func (m *MockPluginClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return m.res, m.err
}
