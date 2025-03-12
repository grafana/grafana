package e2e

import (
	"os"

	"github.com/grafana/e2e"
)

type UnifiedScenario struct {
	*e2e.Scenario

	Grafana        *GrafanaService
	UnifiedStorage *StorageService
	Postgres       *PostgresService
}

func NewUnifiedScenario() (*UnifiedScenario, error) {
	s, err := e2e.NewScenario(GetNetworkName())
	if err != nil {
		return nil, err
	}

	return &UnifiedScenario{
		Scenario: s,
	}, nil
}

func (s *UnifiedScenario) NewGrafanaService(name string, grpcEndpoint string) *GrafanaService {
	flags := map[string]string{}
	envVars := map[string]string{
		"GF_FEATURE_TOGGLES_ENABLE":         "grafanaAPIServerWithExperimentalAPIs, kubernetesClientDashboardsFolders, unifiedStorageSearch",
		"GF_GRAFANA_APISERVER_ADDRESS":      grpcEndpoint,
		"GF_GRAFANA_APISERVER_STORAGE_TYPE": "unified-grpc",
	}

	g := NewGrafanaService(name, flags, envVars)
	s.Grafana = g
	return g
}

func (s *UnifiedScenario) NewGrafanaClient(grafanaName string, orgID int64) (*GrafanaClient, error) {
	g := s.Grafana
	return NewGrafanaClient(g.HTTPEndpoint(), orgID)
}

func (s *UnifiedScenario) NewUnifiedStorageService(name string) *StorageService {
	flags := map[string]string{}
	envVars := map[string]string{
		"GF_DEFAULT_TARGET":                 "storage-server",
		"GF_GRPC_SERVER_ADDRESS":            "0.0.0.0:10000",
		"GF_FEATURE_TOGGLES_ENABLE":         "grpcServer,unifiedStorage",
		"GF_GRAFANA_APISERVER_STORAGE_TYPE": "unified",
		"GF_RESOURCE_API_DB_TYPE":           "postgres",
		"GF_RESOURCE_API_DB_HOST":           "postgres:5432",
		"GF_RESOURCE_API_DB_NAME":           "grafana",
		"GF_RESOURCE_API_DB_USER":           "admin",
		"GF_RESOURCE_API_DB_PASS":           "admin",
	}

	us := NewStorageService(name, flags, envVars)
	s.UnifiedStorage = us
	return us
}

func (s *UnifiedScenario) NewPostgresService(name string) *PostgresService {
	ps := NewPostgresService(name, map[string]string{
		"POSTGRES_USER":     "admin",
		"POSTGRES_PASSWORD": "admin",
		"POSTGRES_DB":       "grafana",
	})
	s.Postgres = ps

	return ps
}

const (
	defaultNetworkName = "e2e-grafana-unified"
)

// GetNetworkName returns the docker network name to run tests within.
func GetNetworkName() string {
	// If the E2E_NETWORK_NAME is set, use that for the network name.
	// Otherwise, return the default network name.
	if os.Getenv("E2E_NETWORK_NAME") != "" {
		return os.Getenv("E2E_NETWORK_NAME")
	}

	return defaultNetworkName
}
