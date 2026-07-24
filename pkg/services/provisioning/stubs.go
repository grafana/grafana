package provisioning

import (
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/provisioning/dashboards"
	"github.com/grafana/grafana/pkg/setting"
)

type StubProvisioningService interface {
	GetDashboardProvisionerResolvedPath(name string) string
	GetAllowUIUpdatesFromConfig(name string) bool
}

func ProvideStubProvisioningService(cfg *setting.Cfg) (StubProvisioningService, error) {
	return NewStubProvisioning(cfg.ProvisioningPath)
}

func NewStubProvisioning(path string) (StubProvisioningService, error) {
	logger := log.New("provisioning.stub")
	stub := &stubProvisioning{
		path:           make(map[string]string),
		allowUIUpdates: make(map[string]bool),
		log:            logger,
	}

	cfgs, err := dashboards.ReadDashboardConfig(filepath.Join(path, "dashboards"))
	if err != nil {
		logger.Warn("can't read dashboard provisioning files from directory", "path", filepath.Join(path, "dashboards"), "error", err)
		return stub, nil
	}

	for _, cfg := range cfgs {
		stub.path[cfg.Name] = cfg.Options["path"].(string)
		stub.allowUIUpdates[cfg.Name] = cfg.AllowUIUpdates
	}
	return stub, nil
}

type stubProvisioning struct {
	path           map[string]string // name > options.path
	allowUIUpdates map[string]bool
	log            log.Logger
}

func (s *stubProvisioning) GetAllowUIUpdatesFromConfig(name string) bool {
	return s.allowUIUpdates[name]
}

func (s *stubProvisioning) GetDashboardProvisionerResolvedPath(name string) string {
	path := s.path[name]
	if _, err := os.Stat(path); os.IsNotExist(err) {
		s.log.Warn("Cannot read directory", "error", err)
	}

	path, err := filepath.Abs(path)
	if err != nil {
		s.log.Warn("Could not create absolute path", "path", path, "error", err)
	}

	path, err = filepath.EvalSymlinks(path)
	if err != nil {
		s.log.Warn("Failed to read content of symlinked path", "path", path, "error", err)
	}

	if path == "" {
		path = s.path[name]
		s.log.Info("falling back to original path due to EvalSymlink/Abs failure")
	}
	return path
}
