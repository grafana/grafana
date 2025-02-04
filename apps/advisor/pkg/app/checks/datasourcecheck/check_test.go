package datasourcecheck

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/stretchr/testify/assert"
)

func TestCheck_Run(t *testing.T) {
	t.Run("should return no errors when all datasources are healthy", func(t *testing.T) {
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
		}

		err := check.Init(context.Background())
		assert.NoError(t, err)
		errs := []advisor.CheckReportError{}
		for _, step := range check.Steps() {
			stepErrs, err := step.Run(context.Background(), &advisor.CheckSpec{})
			assert.NoError(t, err)
			errs = append(errs, stepErrs...)
		}

		assert.NoError(t, err)
		assert.Equal(t, 2, check.ItemsLen())
		assert.Empty(t, errs)
	})

	t.Run("should return errors when datasource UID is invalid", func(t *testing.T) {
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
		}

		err := check.Init(context.Background())
		assert.NoError(t, err)
		errs := []advisor.CheckReportError{}
		for _, step := range check.Steps() {
			stepErrs, err := step.Run(context.Background(), &advisor.CheckSpec{})
			assert.NoError(t, err)
			errs = append(errs, stepErrs...)
		}

		assert.NoError(t, err)
		assert.Equal(t, 1, check.ItemsLen())
		assert.Len(t, errs, 1)
		assert.Equal(t, "Invalid UID 'invalid uid' for data source Prometheus", errs[0].Reason)
	})

	t.Run("should return errors when datasource health check fails", func(t *testing.T) {
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
		}

		err := check.Init(context.Background())
		assert.NoError(t, err)
		errs := []advisor.CheckReportError{}
		for _, step := range check.Steps() {
			stepErrs, err := step.Run(context.Background(), &advisor.CheckSpec{})
			assert.NoError(t, err)
			errs = append(errs, stepErrs...)
		}

		assert.NoError(t, err)
		assert.Equal(t, 1, check.ItemsLen())
		assert.Len(t, errs, 1)
		assert.Equal(t, "Health check failed for Prometheus", errs[0].Reason)
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
	datasource.PluginContextWrapper

	pCtx backend.PluginContext
}

func (m *MockPluginContextProvider) PluginContextForDataSource(ctx context.Context, datasourceSettings *backend.DataSourceInstanceSettings) (backend.PluginContext, error) {
	return m.pCtx, nil
}

type MockPluginClient struct {
	plugins.Client

	res *backend.CheckHealthResult
}

func (m *MockPluginClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return m.res, nil
}
