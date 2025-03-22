package provisioning

import (
	"context"

	"github.com/grafana/grafana/pkg/services/provisioning/datasources"
)

type Calls struct {
	RunInitProvisioners                 []any
	ProvisionDatasources                []any
	ProvisionPlugins                    []any
	ProvisionDashboards                 []any
	ProvisionAlerting                   []any
	GetDashboardProvisionerResolvedPath []any
	GetAllowUIUpdatesFromConfig         []any
	Run                                 []any
	GetCachingDeleteConfigs             []any
	GetCachingCreateConfigs             []any
}

type ProvisioningServiceMock struct {
	Calls                                   *Calls
	RunInitProvisionersFunc                 func(ctx context.Context) error
	ProvisionDatasourcesFunc                func(ctx context.Context) error
	ProvisionPluginsFunc                    func() error
	ProvisionDashboardsFunc                 func() error
	GetDashboardProvisionerResolvedPathFunc func(name string) string
	GetAllowUIUpdatesFromConfigFunc         func(name string) bool
	RunFunc                                 func(ctx context.Context) error
	GetCachingDeleteConfigsFunc             func(ctx context.Context) ([]string, error)
	GetCachingCreateConfigsFunc             func(ctx context.Context) ([]datasources.DatasourceCachingConfig, error)
}

func NewProvisioningServiceMock(ctx context.Context) *ProvisioningServiceMock {
	return &ProvisioningServiceMock{
		Calls: &Calls{},
	}
}

func (mock *ProvisioningServiceMock) RunInitProvisioners(ctx context.Context) error {
	mock.Calls.RunInitProvisioners = append(mock.Calls.RunInitProvisioners, nil)
	if mock.RunInitProvisionersFunc != nil {
		return mock.RunInitProvisionersFunc(ctx)
	}
	return nil
}

func (mock *ProvisioningServiceMock) ProvisionDatasources(ctx context.Context) error {
	mock.Calls.ProvisionDatasources = append(mock.Calls.ProvisionDatasources, nil)
	if mock.ProvisionDatasourcesFunc != nil {
		return mock.ProvisionDatasourcesFunc(ctx)
	}
	return nil
}

func (mock *ProvisioningServiceMock) ProvisionPlugins(ctx context.Context) error {
	mock.Calls.ProvisionPlugins = append(mock.Calls.ProvisionPlugins, nil)
	if mock.ProvisionPluginsFunc != nil {
		return mock.ProvisionPluginsFunc()
	}
	return nil
}

func (mock *ProvisioningServiceMock) ProvisionDashboards(ctx context.Context) error {
	mock.Calls.ProvisionDashboards = append(mock.Calls.ProvisionDashboards, nil)
	if mock.ProvisionDashboardsFunc != nil {
		return mock.ProvisionDashboardsFunc()
	}
	return nil
}

func (mock *ProvisioningServiceMock) ProvisionAlerting(ctx context.Context) error {
	mock.Calls.ProvisionAlerting = append(mock.Calls.ProvisionAlerting, nil)
	return nil
}

func (mock *ProvisioningServiceMock) GetDashboardProvisionerResolvedPath(name string) string {
	mock.Calls.GetDashboardProvisionerResolvedPath = append(mock.Calls.GetDashboardProvisionerResolvedPath, name)
	if mock.GetDashboardProvisionerResolvedPathFunc != nil {
		return mock.GetDashboardProvisionerResolvedPathFunc(name)
	}
	return ""
}

func (mock *ProvisioningServiceMock) GetAllowUIUpdatesFromConfig(name string) bool {
	mock.Calls.GetAllowUIUpdatesFromConfig = append(mock.Calls.GetAllowUIUpdatesFromConfig, name)
	if mock.GetAllowUIUpdatesFromConfigFunc != nil {
		return mock.GetAllowUIUpdatesFromConfigFunc(name)
	}
	return false
}

func (mock *ProvisioningServiceMock) Run(ctx context.Context) error {
	mock.Calls.Run = append(mock.Calls.Run, nil)
	if mock.RunFunc != nil {
		return mock.RunFunc(ctx)
	}
	return nil
}

func (mock *ProvisioningServiceMock) GetCachingDeleteConfigs(ctx context.Context) ([]string, error) {
	mock.Calls.GetCachingDeleteConfigs = append(mock.Calls.GetCachingDeleteConfigs, nil)
	if mock.GetCachingDeleteConfigsFunc != nil {
		return mock.GetCachingDeleteConfigsFunc(ctx)
	}
	return nil, nil
}

func (mock *ProvisioningServiceMock) GetCachingCreateConfigs(ctx context.Context) ([]datasources.DatasourceCachingConfig, error) {
	mock.Calls.GetCachingCreateConfigs = append(mock.Calls.GetCachingCreateConfigs, nil)
	if mock.GetCachingCreateConfigsFunc != nil {
		return mock.GetCachingCreateConfigsFunc(ctx)
	}
	return nil, nil
}
