package lerna

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/build/config"
)

// BuildFrontendPackages will bump the version for the package to the latest canary build
// and build the packages so they are ready for being published, used for generating docs etc.
func BuildFrontendPackages(version string, mode config.Edition, grafanaDir string) error {
	err := bumpLernaVersion(version, grafanaDir)
	if err != nil {
		return err
	}
	cmd := exec.Command("yarn", "run", "packages:build")
	cmd.Dir = grafanaDir
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to build %s frontend packages: %s", mode, output)
	}

	return nil
}

func bumpLernaVersion(version string, grafanaDir string) error {
	//nolint:gosec
	cmd := exec.Command("yarn", "run", "lerna", "version", version, "--exact", "--no-git-tag-version", "--no-push", "--force-publish", "-y")
	cmd.Dir = grafanaDir
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to bump version for frontend packages: %s\n%s", err, output)
	}

	return nil
}

func GetLernaVersion(grafanaDir string) (string, error) {
	lernaJSONPath := filepath.Join(grafanaDir, "lerna.json")
	//nolint:gosec
	lernaJSONB, err := os.ReadFile(lernaJSONPath)
	if err != nil {
		return "", fmt.Errorf("failed to read %q: %w", lernaJSONPath, err)
	}
	pkgObj := map[string]interface{}{}
	if err := json.Unmarshal(lernaJSONB, &pkgObj); err != nil {
		return "", fmt.Errorf("failed decoding %q: %w", lernaJSONPath, err)
	}

	version := pkgObj["version"].(string)
	if version == "" {
		return "", fmt.Errorf("failed to read version from %q", lernaJSONPath)
	}
	return strings.TrimSpace(version), nil
}
