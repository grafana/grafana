package scenarios

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/services/apiserver/apiserver_test/e2eservices"
	"github.com/grafana/grafana/pkg/services/apiserver/apiserver_test/testcontainer"
	"github.com/testcontainers/testcontainers-go"
)

const (
	defaultNetworkName = "e2e-runtime-config"
)

type RuntimeConfigScenario struct {
	*testcontainer.Scenario
	workDir   string
	tempDir   string
	customIni string
	grafana   *e2eservices.GrafanaService
}

func NewRuntimeConfigScenario(ctx context.Context, workDir string, runtimeConfig string) (*RuntimeConfigScenario, error) {
	s, err := testcontainer.NewScenario(ctx, defaultNetworkName)
	if err != nil {
		return nil, err
	}

	// Create a temporary directory for preparing files
	tempDir, err := os.MkdirTemp("", "runtime-config-scenario-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp directory: %w", err)
	}

	// Create a custom.ini file with the runtime_config
	customIni := filepath.Join(tempDir, "custom.ini")
	customIniContent := fmt.Sprintf(`[grafana-apiserver]
runtime_config = %s
[feature_toggles]
grafanaAPIServerWithExperimentalAPIs = true
`, runtimeConfig)

	if err := os.WriteFile(customIni, []byte(customIniContent), 0644); err != nil {
		return nil, fmt.Errorf("failed to write custom.ini: %w", err)
	}

	return &RuntimeConfigScenario{
		Scenario:  s,
		workDir:   workDir,
		tempDir:   tempDir,
		customIni: customIni,
	}, nil
}

func (s *RuntimeConfigScenario) NewGrafanaService() *e2eservices.GrafanaService {
	files := []testcontainers.ContainerFile{
		{
			HostFilePath:      s.customIni,
			ContainerFilePath: "/usr/share/grafana/conf/grafana.ini",
			FileMode:          0644,
		},
	}

	grafana := e2eservices.NewGrafanaService("st-grafana", s.workDir, s.tempDir, map[string]string{}, map[string]string{
		"GF_PATHS_DATA":         "/var/lib/grafana",
		"GF_PATHS_CONFIG":       "/usr/share/grafana/conf/grafana.ini",
		"GF_PATHS_PROVISIONING": "/usr/share/grafana/conf/provisioning",
	}, s.Network(), files)
	s.grafana = grafana
	return grafana
}

// Close cleans up the scenario and temporary directory
func (s *RuntimeConfigScenario) Close() error {
	// Clean up temp directory
	if s.tempDir != "" {
		_ = os.RemoveAll(s.tempDir)
	}
	// Call parent Close
	return s.Scenario.Close()
}
