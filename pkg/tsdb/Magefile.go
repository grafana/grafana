//go:build mage

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	build "github.com/grafana/grafana-plugin-sdk-go/build"
)

func find(dir string, name string) ([]string, error) {
	files := []string{}
	err := filepath.Walk(dir, func(path string, f os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if filepath.Base(path) == name {
			files = append(files, path)
		}
		return nil
	})

	return files, err
}

func fileHasString(path string, s string) bool {
	f, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	return strings.Contains(string(f), s)
}

func findPluginJSONDir(pluginID string) (string, error) {
	pluginJSONMatches, err := filepath.Glob("../../public/app/plugins/datasource/*/plugin.json")
	if err != nil {
		return "", err
	}
	if len(pluginJSONMatches) == 0 {
		return "", fmt.Errorf("Could not find plugin.json")
	}
	pluginJSONPath := ""
	for _, pluginJSONMatch := range pluginJSONMatches {
		if !fileHasString(pluginJSONMatch, fmt.Sprintf(`"id": "%s"`, pluginID)) {
			continue
		}
		pluginJSONPath = pluginJSONMatch
		break
	}
	pluginJSONPath, err = filepath.Abs(pluginJSONPath)
	if err != nil {
		return "", err
	}
	return filepath.Dir(pluginJSONPath), nil
}

func findRootDir(pluginID string) (string, error) {
	matches, err := find(".", "main.go")
	if err != nil {
		return "", err
	}
	if len(matches) == 0 {
		return "", fmt.Errorf("Could not find main.go")
	}
	pluginDir := ""
	for _, match := range matches {
		if fileHasString(match, fmt.Sprintf(`datasource.Manage("%s"`, pluginID)) {
			pluginDir = filepath.Dir(match)
			break
		}
	}
	if pluginDir == "" {
		return "", nil
	}
	return filepath.Abs(pluginDir)
}

func buildPlugin(rootDir, pluginJSONDir string) {
	distDir := filepath.Join(pluginJSONDir, "dist")

	configCallback := func(cfg build.Config) (build.Config, error) {
		cfg.OutputBinaryPath = distDir
		cfg.PluginJSONPath = pluginJSONDir
		cfg.RootPackagePath = rootDir
		return cfg, nil
	}
	build.SetBeforeBuildCallback(configCallback)
	build.BuildAll()
}

func BuildPlugin(pluginID string) error {
	rootDir, err := findRootDir(pluginID)
	if err != nil {
		return err
	}
	pluginJSONDir, err := findPluginJSONDir(pluginID)
	if err != nil {
		return err
	}
	buildPlugin(rootDir, pluginJSONDir)
	return nil
}
