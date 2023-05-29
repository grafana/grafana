package commands

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
)

func validateInput(c utils.CommandLine, pluginFolder string) error {
	arg := c.Args().First()
	if arg == "" {
		return errors.New("please specify plugin to install")
	}

	pluginsDir := c.PluginDirectory()
	if pluginsDir == "" {
		return errors.New("missing pluginsDir flag")
	}

	fileInfo, err := os.Stat(pluginsDir)
	if err != nil {
		if err = os.MkdirAll(pluginsDir, os.ModePerm); err != nil {
			return fmt.Errorf("pluginsDir (%s) is not a writable directory", pluginsDir)
		}
		return nil
	}

	if !fileInfo.IsDir() {
		return errors.New("path is not a directory")
	}

	return nil
}

func logRestartNotice() {
	logger.Info(color.GreenString("Please restart Grafana after installing or removing plugins. Refer to Grafana documentation for instructions if necessary.\n\n"))
}

func installCommand(c utils.CommandLine) error {
	pluginFolder := c.PluginDirectory()
	if err := validateInput(c, pluginFolder); err != nil {
		return err
	}

	pluginID := c.Args().First()
	version := c.Args().Get(1)
	err := installPlugin(context.Background(), pluginID, version, c)
	if err == nil {
		logRestartNotice()
	}
	return err
}

// installPlugin downloads the plugin code as a zip file from the Grafana.com API
// and then extracts the zip into the plugin's directory.
func installPlugin(ctx context.Context, pluginID, version string, c utils.CommandLine) error {
	repository := repo.NewManager(repo.ManagerCfg{
		SkipTLSVerify: c.Bool("insecure"),
		BaseURL:       c.PluginRepoURL(),
		Logger:        services.Logger,
	})

	compatOpts := repo.NewCompatOpts(services.GrafanaVersion, runtime.GOOS, runtime.GOARCH)

	var archive *repo.PluginArchive
	var err error
	pluginZipURL := c.PluginURL()
	if pluginZipURL != "" {
		if archive, err = repository.GetPluginArchiveByURL(ctx, pluginZipURL, compatOpts); err != nil {
			return err
		}
	} else {
		if archive, err = repository.GetPluginArchive(ctx, pluginID, version, compatOpts); err != nil {
			return err
		}
	}

	pluginFs := storage.FileSystem(services.Logger, c.PluginDirectory())
	extractedArchive, err := pluginFs.Extract(ctx, pluginID, archive.File)
	if err != nil {
		return err
	}

	for _, dep := range extractedArchive.Dependencies {
		services.Logger.Infof("Fetching %s dependency...", dep.ID)
		d, err := repository.GetPluginArchive(ctx, dep.ID, dep.Version, compatOpts)
		if err != nil {
			return fmt.Errorf("%v: %w", fmt.Sprintf("failed to download plugin %s from repository", dep.ID), err)
		}

		_, err = pluginFs.Extract(ctx, dep.ID, d.File)
		if err != nil {
			return err
		}
	}
	return nil
}

// uninstallPlugin removes the plugin directory
func uninstallPlugin(_ context.Context, pluginID string, c utils.CommandLine) error {
	logger.Infof("Removing plugin: %v\n", pluginID)

	pluginPath := filepath.Join(c.PluginDirectory(), pluginID)
	fs := plugins.NewLocalFS(pluginPath)

	logger.Debugf("Removing directory %v\n", pluginPath)
	err := fs.Remove()
	if err != nil {
		return err
	}
	return nil
}

func osAndArchString() string {
	osString := strings.ToLower(runtime.GOOS)
	arch := runtime.GOARCH
	return osString + "-" + arch
}

func supportsCurrentArch(version models.Version) bool {
	if version.Arch == nil {
		return true
	}
	for arch := range version.Arch {
		if arch == osAndArchString() || arch == "any" {
			return true
		}
	}
	return false
}

func latestSupportedVersion(plugin models.Plugin) *models.Version {
	for _, v := range plugin.Versions {
		ver := v
		if supportsCurrentArch(ver) {
			return &ver
		}
	}
	return nil
}
