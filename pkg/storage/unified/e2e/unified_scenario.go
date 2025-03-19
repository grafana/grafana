package e2e

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

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

func (s *UnifiedScenario) NewGrafanaService(name string, grpcEndpoint string) (*GrafanaService, error) {
	flags := map[string]string{
		"--config": fmt.Sprintf("/shared/%s.ini", name),
	}
	fts := []string{
		"grafanaAPIServerWithExperimentalAPIs",
		"kubernetesClientDashboardsFolders",
		"grafanaAPIServerEnsureKubectlAccess",
		"unifiedStorageSearch",
		"unifiedStorageSearchUI",
		"kubernetesCliDashboards",
		"kubernetesDashboardsAPI",
		"kubernetesFolders",
		"unified_storage",
	}
	envVars := map[string]string{
		"GF_PATHS_CONFIG":                   fmt.Sprintf("/shared/%s.ini", name),
		"GF_FEATURE_TOGGLES_ENABLE":         strings.Join(fts, ","),
		"GF_GRAFANA_APISERVER_ADDRESS":      grpcEndpoint,
		"GF_GRAFANA_APISERVER_STORAGE_TYPE": "unified-grpc",
		"GF_DATABASE_TYPE":                  "postgres",
		"GF_DATABASE_HOST":                  "postgres:5432",
		"GF_DATABASE_NAME":                  "grafana",
		"GF_DATABASE_USER":                  "admin",
		"GF_DATABASE_PASSWORD":              "admin",
		"GF_DATABASE_SSL_MODE":              "disable",
	}

	if err := s.loadCfg(name, grafanaINI); err != nil {
		return nil, err
	}
	g := NewGrafanaService(name, flags, envVars)
	s.Grafana = g
	return g, nil
}

func (s *UnifiedScenario) NewGrafanaClient(grafanaName string, orgID int64) (*GrafanaClient, error) {
	g := s.Grafana
	return NewGrafanaClient(g.HTTPEndpoint(), orgID)
}

func (s *UnifiedScenario) NewStorageService(name string) (*StorageService, error) {
	flags := map[string]string{
		"--config": "/shared/storage.ini",
	}
	envVars := map[string]string{
		"GF_PATHS_CONFIG":           "/shared/storage.ini",
		"GF_DEFAULT_TARGET":         "storage-server",
		"GF_GRPC_SERVER_ADDRESS":    "0.0.0.0:10000",
		"GF_FEATURE_TOGGLES_ENABLE": "unifiedStorage,unifiedStorageSearch",
		"GF_RESOURCE_API_DB_TYPE":   "postgres",
		"GF_RESOURCE_API_DB_HOST":   "postgres:5432",
		"GF_RESOURCE_API_DB_NAME":   "grafana",
		"GF_RESOURCE_API_DB_USER":   "admin",
		"GF_RESOURCE_API_DB_PASS":   "admin",
		"GF_DATABASE_TYPE":          "postgres",
		"GF_DATABASE_HOST":          "postgres:5432",
		"GF_DATABASE_NAME":          "grafana",
		"GF_DATABASE_USER":          "admin",
		"GF_DATABASE_PASSWORD":      "admin",
		"GF_DATABASE_SSL_MODE":      "disable",
	}

	if err := s.loadCfg(name, storageINI); err != nil {
		return nil, err
	}
	us := NewStorageService(name, flags, envVars)
	s.UnifiedStorage = us
	return us, nil
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

func (s *UnifiedScenario) loadCfg(svc, content string) error {
	dst := fmt.Sprintf("%s/%s.ini", s.SharedDir(), svc)
	destination, err := os.Create(filepath.Clean(dst))
	if err != nil {
		return err
	}

	_, err = destination.Write([]byte(content))
	if err != nil {
		return err
	}

	return nil
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
