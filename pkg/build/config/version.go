package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// GenerateGrafanaVersion gets the Grafana version from the package.json
func GenerateGrafanaVersion(buildID, grafanaDir string) (string, error) {
	version, err := GetPackageJSONVersion(grafanaDir)
	if err != nil {
		return version, err
	}
	if buildID != "" {
		buildID = shortenBuildID(buildID)
		verComponents := strings.Split(version, "-")
		version = verComponents[0]
		version = fmt.Sprintf("%s-%s", version, buildID)
	}

	return version, nil
}

func GetPackageJSONVersion(grafanaDir string) (string, error) {
	pkgJSONPath := filepath.Join(grafanaDir, "package.json")
	//nolint:gosec
	pkgJSONB, err := os.ReadFile(pkgJSONPath)
	if err != nil {
		return "", fmt.Errorf("failed to read %q: %w", pkgJSONPath, err)
	}
	pkgObj := map[string]any{}
	if err := json.Unmarshal(pkgJSONB, &pkgObj); err != nil {
		return "", fmt.Errorf("failed decoding %q: %w", pkgJSONPath, err)
	}

	version := pkgObj["version"].(string)
	if version == "" {
		return "", fmt.Errorf("failed to read version from %q", pkgJSONPath)
	}
	return version, nil
}

func shortenBuildID(buildID string) string {
	buildID = strings.ReplaceAll(buildID, "-", "")
	if len(buildID) < 9 {
		return buildID
	}

	return buildID[0:8]
}
