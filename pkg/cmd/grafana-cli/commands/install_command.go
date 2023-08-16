package commands

import (
	"context"
	"errors"
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/Masterminds/semver/v3"
	"github.com/fatih/color"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
)

const installArgsSize = 2

func validateInput(c utils.CommandLine) error {
	args := c.Args()
	argsLen := args.Len()

	if argsLen > installArgsSize {
		logger.Info(color.RedString("Please specify the correct format. For example ./grafana cli (<command arguments>) plugins install <plugin ID> (<plugin version>)\n\n"))
		return errors.New("install only supports 2 arguments: plugin and version")
	}

	arg := args.First()
	if arg == "" {
		return errors.New("please specify plugin to install")
	}

	if argsLen == installArgsSize {
		version := args.Get(1)
		_, err := semver.NewVersion(version)
		if err != nil {
			logger.Info(color.YellowString("The provided version doesn't use semantic versioning format\n\n"))
		}
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
	if err := validateInput(c); err != nil {
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
	// If a version is specified, check if it is already installed
	if version != "" {
		if services.PluginVersionInstalled(pluginID, version, c.PluginDirectory()) {
			services.Logger.Successf("Plugin %s v%s already installed.", pluginID, version)
			return nil
		}
	}

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
	extractedArchive, err := pluginFs.Extract(ctx, pluginID, storage.SimpleDirNameGeneratorFunc, archive.File)
	if err != nil {
		return err
	}

	for _, dep := range extractedArchive.Dependencies {
		services.Logger.Infof("Fetching %s dependency...", dep.ID)
		d, err := repository.GetPluginArchive(ctx, dep.ID, dep.Version, compatOpts)
		if err != nil {
			return fmt.Errorf("%v: %w", fmt.Sprintf("failed to download plugin %s from repository", dep.ID), err)
		}

		_, err = pluginFs.Extract(ctx, dep.ID, storage.SimpleDirNameGeneratorFunc, d.File)
		if err != nil {
			return err
		}
	}
	return nil
}

// uninstallPlugin removes the plugin directory
func uninstallPlugin(_ context.Context, pluginID string, c utils.CommandLine) error {
	for _, bundle := range services.GetLocalPlugins(c.PluginDirectory()) {
		if bundle.Primary.JSONData.ID == pluginID {
			logger.Infof("Removing plugin: %v\n", pluginID)
			if remover, ok := bundle.Primary.FS.(plugins.FSRemover); ok {
				logger.Debugf("Removing directory %v\n\n", bundle.Primary.FS.Base())
				if err := remover.Remove(); err != nil {
					return err
				}
				return nil
			} else {
				return fmt.Errorf("plugin %v is immutable and therefore cannot be uninstalled", pluginID)
			}
		}
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
