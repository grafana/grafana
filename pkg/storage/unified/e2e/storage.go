package e2e

import (
	"github.com/grafana/e2e"
)

const (
	storageINI = `
app_mode = development
target = storage-server

[grafana-apiserver]
storage_type = unified

[database]
type = postgres
host = postgres:5432
name = grafana
user = admin
password = admin
ssl_mode = disable
`
)

type StorageService struct {
	*e2e.ConcreteService
}

func NewStorageService(name string, flags, envVars map[string]string) *StorageService {
	args := append([]string{"target"}, e2e.BuildArgs(flags)...)
	svc := &StorageService{
		ConcreteService: e2e.NewConcreteService(
			name,
			GetGrafanaImage(),
			e2e.NewCommandWithoutEntrypoint(grafanaBinary, args...),
			e2e.NewTCPReadinessProbe(10000),
			10000,
		),
	}

	svc.SetEnvVars(envVars)
	svc.Endpoint(10000)

	return svc
}

// TODO: remove this method when the storage-server module has a graceful shutdown on docker stop
// the following method is implemented because the storage-server module is not shutting down gracefully
// https://github.com/grafana/search-and-storage-team/issues/228
func (s *StorageService) Stop() error {
	_ = s.ConcreteService.Stop()
	return nil
}

func (s *StorageService) GRPCEndpoint() string {
	return s.NetworkEndpoint(grafanaGRPCPort)
}
