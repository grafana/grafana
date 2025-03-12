package e2e

import (
	"github.com/grafana/e2e"
)

const (
	storageServerCmd = "grafana-server target"
)

type StorageService struct {
	*e2e.ConcreteService
}

func NewStorageService(name string, flags, envVars map[string]string) *StorageService {
	svc := &StorageService{
		ConcreteService: e2e.NewConcreteService(
			name,
			GetGrafanaImage(),
			e2e.NewCommand(storageServerCmd,
				e2e.BuildArgs(flags)...),
			e2e.NewTCPReadinessProbe(10000),
			10000,
		),
	}

	svc.SetEnvVars(envVars)

	return svc
}

func (g *StorageService) GRPCEndpoint() string {
	return g.NetworkEndpoint(grafanaGRPCPort)
}
