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
		// If the directory does not exist, try to create it with permissions enough
		// so the server running Grafana can write to it to install new plugins.
		// nolint: gosec
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
	err := installPlugin(context.Background(), pluginID, version, newInstallPluginOpts(c))
	if err == nil {
		logRestartNotice()
	}
	return err
}

type pluginInstallOpts struct {
	insecure  bool
	repoURL   string
	pluginURL string
	pluginDir string
	gcomToken string
}

func newInstallPluginOpts(c utils.CommandLine) pluginInstallOpts {
	return pluginInstallOpts{
		insecure:  c.Bool("insecure"),
		repoURL:   c.PluginRepoURL(),
		pluginURL: c.PluginURL(),
		pluginDir: c.PluginDirectory(),
		gcomToken: c.GcomToken(),
	}
}

// installPlugin downloads the plugin code as a zip file from the Grafana.com API
// and then extracts the zip into the plugin's directory.
func installPlugin(ctx context.Context, pluginID, version string, o pluginInstallOpts) error {
	return doInstallPlugin(ctx, pluginID, version, o, map[string]bool{})
}

// doInstallPlugin is a recursive function that installs a plugin and its dependencies.
// installing is a map that keeps track of which plugins are currently being installed to avoid infinite loops.
func doInstallPlugin(ctx context.Context, pluginID, version string, o pluginInstallOpts, installing map[string]bool) error {
	if installing[pluginID] {
		return nil
	}
	installing[pluginID] = true
	defer func() {
		installing[pluginID] = false
	}()

	// If a version is specified, check if it is already installed
	if version != "" {
		if p, ok := services.PluginVersionInstalled(pluginID, version, o.pluginDir); ok {
			services.Logger.Successf("Plugin %s v%s already installed.", pluginID, version)
			for _, depP := range p.JSONData.Dependencies.Plugins {
				if err := doInstallPlugin(ctx, depP.ID, "", o, installing); err != nil {
					return err
				}
			}
			return nil
		}
	}

	repository := repo.NewManager(repo.ManagerCfg{
		SkipTLSVerify:      o.insecure,
		BaseURL:            o.repoURL,
		Logger:             services.Logger,
		GrafanaComAPIToken: o.gcomToken,
	})

	compatOpts := repo.NewCompatOpts(services.GrafanaVersion, runtime.GOOS, runtime.GOARCH)

	var archive *repo.PluginArchive
	var err error
	if o.pluginURL != "" {
		archive, err = repository.GetPluginArchiveByURL(ctx, o.pluginURL, compatOpts)
		if err != nil {
			return err
		}
	} else {
		ctx = repo.WithRequestOrigin(ctx, "cli")
		archiveInfo, err := repository.GetPluginArchiveInfo(ctx, pluginID, version, compatOpts)
		if err != nil {
			return err
		}

		if p, ok := services.PluginVersionInstalled(pluginID, archiveInfo.Version, o.pluginDir); ok {
			services.Logger.Successf("Plugin %s v%s already installed.", pluginID, archiveInfo.Version)
			for _, depP := range p.JSONData.Dependencies.Plugins {
				if err = doInstallPlugin(ctx, depP.ID, "", o, installing); err != nil {
					return err
				}
			}
			return nil
		}

		if archive, err = repository.GetPluginArchiveByURL(ctx, archiveInfo.URL, compatOpts); err != nil {
			return err
		}
	}

	pluginFs := storage.FileSystem(services.Logger, o.pluginDir)
	extractedArchive, err := pluginFs.Extract(ctx, pluginID, storage.SimpleDirNameGeneratorFunc, archive.File)
	if err != nil {
		return err
	}

	for _, dep := range extractedArchive.Dependencies {
		services.Logger.Infof("Fetching %s dependency %s...", pluginID, dep.ID)
		err = doInstallPlugin(ctx, dep.ID, "", pluginInstallOpts{
			insecure:  o.insecure,
			repoURL:   o.repoURL,
			pluginDir: o.pluginDir,
		}, installing)
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
