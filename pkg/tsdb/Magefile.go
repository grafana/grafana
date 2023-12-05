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

func findPluginJSONDir(pluginDir string) (string, error) {
	pluginJSONMatches, err := find(filepath.Join("../../public/app/plugins/datasource", pluginDir), "plugin.json")
	if err != nil {
		return "", err
	}
	if len(pluginJSONMatches) == 0 {
		return "", fmt.Errorf("Could not find plugin.json")
	}
	pluginJSONPath := ""
	for _, pluginJSONMatch := range pluginJSONMatches {
		// Ignore dist folder
		if filepath.Base(filepath.Dir(pluginJSONMatch)) != "dist" {
			pluginJSONPath = pluginJSONMatch
		}
	}
	pluginJSONPath, err = filepath.Abs(pluginJSONPath)
	if err != nil {
		return "", err
	}
	return filepath.Dir(pluginJSONPath), nil
}

func findRootDir(pluginDir string) (string, error) {
	matches, err := find(pluginDir, "main.go")
	if err != nil {
		return "", err
	}
	if len(matches) == 0 {
		return "", fmt.Errorf("Could not find main.go")
	}
	absolutePath, err := filepath.Abs(matches[0])
	if err != nil {
		return "", err
	}
	return filepath.Dir(absolutePath), nil
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

func BuildPlugin(pluginDir string) error {
	rootDir, err := findRootDir(pluginDir)
	if err != nil {
		return err
	}
	pluginJSONDir, err := findPluginJSONDir(pluginDir)
	if err != nil {
		return err
	}
	buildPlugin(rootDir, pluginJSONDir)
	return nil
}

func BuildAllPlugins() error {
	// Plugins need to have a main.go file
	matches, err := find(".", "main.go")
	if err != nil {
		return err
	}
	for _, match := range matches {
		// Get the directory name of the plugin
		parts := strings.Split(filepath.ToSlash(match), "/")
		if len(parts) == 0 {
			continue
		}
		pluginDir := parts[0]
		rootDir, err := findRootDir(pluginDir)
		if err != nil {
			return err
		}
		pluginJSONDir, err := findPluginJSONDir(pluginDir)
		if err != nil {
			return err
		}
		buildPlugin(rootDir, pluginJSONDir)
	}
	return nil
}

// Default configures the default target.
var Default = BuildAllPlugins
