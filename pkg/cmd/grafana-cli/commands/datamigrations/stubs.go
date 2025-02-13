package datamigrations

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/provisioning/dashboards"
)

var (
	_ provisioning.ProvisioningService = (*stubProvisioning)(nil)
)

func newStubProvisioning(path string) (provisioning.ProvisioningService, error) {
	cfgs, err := dashboards.ReadDashboardConfig(filepath.Join(path, "dashboards"))
	if err != nil {
		return nil, err
	}
	stub := &stubProvisioning{
		path: make(map[string]string),
	}
	for _, cfg := range cfgs {
		stub.path[cfg.Name] = cfg.Options["path"].(string)
	}
	return &stubProvisioning{}, nil
}

type stubProvisioning struct {
	path map[string]string // name > options.path
}

// GetAllowUIUpdatesFromConfig implements provisioning.ProvisioningService.
func (s *stubProvisioning) GetAllowUIUpdatesFromConfig(name string) bool {
	return false
}

func (s *stubProvisioning) GetDashboardProvisionerResolvedPath(name string) string {
	return s.path[name]
}

// ProvisionAlerting implements provisioning.ProvisioningService.
func (s *stubProvisioning) ProvisionAlerting(ctx context.Context) error {
	panic("unimplemented")
}

// ProvisionDashboards implements provisioning.ProvisioningService.
func (s *stubProvisioning) ProvisionDashboards(ctx context.Context) error {
	panic("unimplemented")
}

// ProvisionDatasources implements provisioning.ProvisioningService.
func (s *stubProvisioning) ProvisionDatasources(ctx context.Context) error {
	panic("unimplemented")
}

// ProvisionPlugins implements provisioning.ProvisioningService.
func (s *stubProvisioning) ProvisionPlugins(ctx context.Context) error {
	panic("unimplemented")
}

// Run implements provisioning.ProvisioningService.
func (s *stubProvisioning) Run(ctx context.Context) error {
	panic("unimplemented")
}

// RunInitProvisioners implements provisioning.ProvisioningService.
func (s *stubProvisioning) RunInitProvisioners(ctx context.Context) error {
	panic("unimplemented")
}
