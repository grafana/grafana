package scenarios

import (
	"context"
	"fmt"
	"os"
	"path"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/fs"
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
	customIniContent := fmt.Sprintf(`
app_mode = development

[auth.anonymous]
enabled = true
org_name = Main Org.
org_role = Admin

[grafana-apiserver]
runtime_config = %s

[feature_toggles]
grafanaAPIServerEnsureKubectlAccess = true
`, runtimeConfig)

	if err := os.WriteFile(customIni, []byte(customIniContent), 0644); err != nil {
		return nil, fmt.Errorf("failed to write custom.ini: %w", err)
	}

	scenario := &RuntimeConfigScenario{
		Scenario:  s,
		workDir:   workDir,
		tempDir:   tempDir,
		customIni: customIni,
	}
	grafana, err := newGrafanaService(scenario)
	if err != nil {
		return nil, err
	}
	scenario.grafana = grafana
	return scenario, nil
}

func newGrafanaService(s *RuntimeConfigScenario) (*e2eservices.GrafanaService, error) {
	provisioningPath := filepath.Join(s.tempDir, "provisioning")
	err := os.MkdirAll(provisioningPath, 0750)
	if err != nil {
		panic(fmt.Errorf("failed to create provisioning directory: %w", err))
	}

	err = fs.CopyRecursive(path.Join(s.workDir, "conf/provisioning"), provisioningPath)
	if err != nil {
		panic(fmt.Errorf("failed to copy provisioning directory: %w", err))
	}
	files := []testcontainers.ContainerFile{
		{
			HostFilePath:      s.customIni,
			ContainerFilePath: "/usr/share/grafana/conf/grafana.ini",
			FileMode:          0644,
		},
		{
			HostFilePath:      provisioningPath,
			ContainerFilePath: "/usr/share/grafana/conf/provisioning",
			FileMode:          0644,
		},
	}

	grafana := e2eservices.NewGrafanaService("st-grafana", s.workDir, s.tempDir, map[string]string{}, map[string]string{
		"GF_PATHS_DATA":         "/var/lib/grafana",
		"GF_PATHS_CONFIG":       "/usr/share/grafana/conf/grafana.ini",
		"GF_PATHS_PROVISIONING": "/usr/share/grafana/conf/provisioning",
	}, s.Network(), files)

	return grafana, nil
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
