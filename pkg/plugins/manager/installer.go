package manager

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
)

var _ plugins.Installer = (*PluginInstaller)(nil)

type PluginInstaller struct {
	pluginRepo           repo.Service
	pluginStorage        storage.ZipExtractor
	pluginStorageDirFunc storage.DirNameGeneratorFunc
	pluginRegistry       registry.Service
	pluginLoader         loader.Service
	cfg                  *config.PluginManagementCfg

	installing      sync.Map
	log             log.Logger
	serviceRegistry auth.ExternalServiceRegistry
	rbacCleaner     auth.RBACCleaner
}

func ProvideInstaller(cfg *config.PluginManagementCfg, pluginRegistry registry.Service, pluginLoader loader.Service,
	pluginRepo repo.Service, serviceRegistry auth.ExternalServiceRegistry, rbacCleaner auth.RBACCleaner) *PluginInstaller {
	return New(cfg, pluginRegistry, pluginLoader, pluginRepo,
		storage.FileSystem(log.NewPrettyLogger("installer.fs"), cfg.PluginsPaths[0]), storage.SimpleDirNameGeneratorFunc, serviceRegistry, rbacCleaner)
}

func New(cfg *config.PluginManagementCfg, pluginRegistry registry.Service, pluginLoader loader.Service,
	pluginRepo repo.Service, pluginStorage storage.ZipExtractor, pluginStorageDirFunc storage.DirNameGeneratorFunc,
	serviceRegistry auth.ExternalServiceRegistry, rbacCleaner auth.RBACCleaner) *PluginInstaller {
	return &PluginInstaller{
		pluginLoader:         pluginLoader,
		pluginRegistry:       pluginRegistry,
		pluginRepo:           pluginRepo,
		pluginStorage:        pluginStorage,
		pluginStorageDirFunc: pluginStorageDirFunc,
		cfg:                  cfg,
		installing:           sync.Map{},
		log:                  log.New("plugin.installer"),
		serviceRegistry:      serviceRegistry,
		rbacCleaner:          rbacCleaner,
	}
}

func (m *PluginInstaller) Add(ctx context.Context, pluginID, version string, opts plugins.AddOpts) error {
	if ok, _ := m.installing.Load(pluginID); ok != nil {
		return nil
	}
	m.installing.Store(pluginID, true)
	defer func() {
		m.installing.Delete(pluginID)
	}()

	archive, previous, err := m.install(ctx, pluginID, version, opts)
	if err != nil {
		return err
	}
	if previous != nil {
		// Once the update has replaced the previous version, the staging directory no longer exists.
		stagingDir := archive.Path
		defer func() {
			if err := os.RemoveAll(stagingDir); err != nil {
				m.log.Warn("Failed to remove staged plugin update", "pluginId", pluginID, "path", stagingDir, "error", err)
			}
		}()
	}

	for _, dep := range archive.Dependencies {
		m.log.Info(fmt.Sprintf("Fetching %s dependency %s...", pluginID, dep.ID))

		err = m.Add(ctx, dep.ID, "", plugins.NewAddOpts(opts.GrafanaVersion(), opts.OS(), opts.Arch(), ""))
		if err != nil {
			if _, ok := errors.AsType[plugins.DuplicateError](err); ok {
				m.log.Info("Dependency already installed", "pluginId", dep.ID)
				continue
			}
			return fmt.Errorf("%v: %w", fmt.Sprintf("failed to download plugin %s from repository", dep.ID), err)
		}
	}

	if previous != nil {
		if err := m.replace(ctx, previous, archive); err != nil {
			return err
		}
	}

	_, err = m.pluginLoader.Load(ctx, sources.NewLocalSource(plugins.ClassExternal, []string{archive.Path}))
	if err != nil {
		m.log.Error("Could not load plugins", "path", archive.Path, "error", err)
		return err
	}

	return nil
}

// install downloads and extracts the plugin. When the plugin is already installed it returns the
// previous version, which keeps running until replace swaps in the new one.
func (m *PluginInstaller) install(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, *plugins.Plugin, error) {
	var pluginArchive *repo.PluginArchive
	var previous *plugins.Plugin
	dirNameFunc := m.pluginStorageDirFunc
	compatOpts, err := RepoCompatOpts(opts)
	if err != nil {
		return nil, nil, err
	}
	if plugin, exists := m.plugin(ctx, pluginID, version); exists {
		if plugin.IsCorePlugin() {
			return nil, nil, plugins.ErrInstallCorePlugin
		}

		if plugin.Info.Version == version {
			return nil, nil, plugins.DuplicateError{
				PluginID: plugin.ID,
			}
		}
		if opts.URL() != "" {
			pluginArchive, err = m.updateFromURL(ctx, plugin, opts.URL(), compatOpts)
		} else {
			pluginArchive, err = m.updateFromCatalog(ctx, plugin, version, compatOpts)
		}
		if err != nil {
			return nil, nil, err
		}
		previous = plugin
		// The previous version keeps running from its own files until the new one is fully extracted.
		dirNameFunc = func(pluginID string) string {
			return "." + m.pluginStorageDirFunc(pluginID) + ".staging"
		}
	} else {
		var err error
		if opts.URL() != "" {
			pluginArchive, err = m.pluginRepo.GetPluginArchiveByURL(ctx, opts.URL(), compatOpts)
		} else {
			pluginArchive, err = m.pluginRepo.GetPluginArchive(ctx, pluginID, version, compatOpts)
		}
		if err != nil {
			return nil, nil, err
		}
		m.log.Info("Installing plugin", "pluginId", pluginID, "version", version)
	}

	extractedArchive, err := m.pluginStorage.Extract(ctx, pluginID, dirNameFunc, pluginArchive.File)
	if err != nil {
		return nil, nil, err
	}

	// Check that the extracted plugin archive has the expected ID and version
	// but avoid a hard error for backwards compatibility with older plugins
	if extractedArchive.ID != pluginID {
		m.log.Error("Installed plugin ID mismatch", "expected", pluginID, "got", extractedArchive.ID)
	}
	if version != "" && extractedArchive.Version != version {
		m.log.Error("Installed plugin version mismatch", "expected", version, "got", extractedArchive.Version)
	}

	return extractedArchive, previous, nil
}

// replace unloads the previous version and moves the staged new version into the install
// directory. Downloading and extracting have already succeeded by now, so what's left only touches
// the install directory, where the new version was just written.
func (m *PluginInstaller) replace(ctx context.Context, previous *plugins.Plugin, staged *storage.ExtractedPluginArchive) error {
	targetDir := filepath.Join(filepath.Dir(staged.Path), m.pluginStorageDirFunc(previous.ID))
	previousElsewhere := !isWithinDir(targetDir, previous.FS.Base())

	if _, err := m.unload(ctx, previous); err != nil {
		return err
	}
	if err := os.RemoveAll(targetDir); err != nil {
		return err
	}
	if err := os.Rename(staged.Path, targetDir); err != nil {
		return err
	}
	staged.Path = targetDir

	if !previousElsewhere {
		return nil
	}
	// Best effort: the new version takes precedence on the next start, so a copy that can't be
	// removed (e.g. from a read-only plugins path) is only reported.
	if remover, ok := previous.FS.(plugins.FSRemover); ok {
		if err := remover.Remove(); err != nil {
			m.log.Warn("Failed to remove previous plugin version, keeping it alongside the new one", "pluginId", previous.ID, "path", previous.FS.Base(), "error", err)
		}
	}

	return nil
}

func isWithinDir(dir, path string) bool {
	rel, err := filepath.Rel(dir, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func (m *PluginInstaller) updateFromURL(ctx context.Context, plugin *plugins.Plugin, url string, compatOpts repo.CompatOpts) (*repo.PluginArchive, error) {
	m.log.Info("Updating plugin", "pluginId", plugin.ID, "from", plugin.Info.Version, "url", url)

	return m.pluginRepo.GetPluginArchiveByURL(ctx, url, compatOpts)
}

func (m *PluginInstaller) updateFromCatalog(ctx context.Context, plugin *plugins.Plugin, version string, compatOpts repo.CompatOpts) (*repo.PluginArchive, error) {
	// get plugin update information to confirm if target update is possible
	pluginArchiveInfo, err := m.pluginRepo.GetPluginArchiveInfo(ctx, plugin.ID, version, compatOpts)
	if err != nil {
		return nil, err
	}

	m.log.Info("Updating plugin", "pluginId", plugin.ID, "from", plugin.Info.Version, "to", pluginArchiveInfo.Version)

	// if existing plugin version is the same as the target update version
	if pluginArchiveInfo.Version == plugin.Info.Version {
		return nil, plugins.DuplicateError{
			PluginID: plugin.ID,
		}
	}

	if pluginArchiveInfo.URL == "" && pluginArchiveInfo.Version == "" {
		return nil, fmt.Errorf("could not determine update options for %s", plugin.ID)
	}

	if pluginArchiveInfo.URL != "" {
		return m.pluginRepo.GetPluginArchiveByURL(ctx, pluginArchiveInfo.URL, compatOpts)
	} else {
		return m.pluginRepo.GetPluginArchive(ctx, plugin.ID, pluginArchiveInfo.Version, compatOpts)
	}
}

func (m *PluginInstaller) Remove(ctx context.Context, pluginID, version string) error {
	childIDs, err := m.unloadAndDelete(ctx, pluginID, version)
	if err != nil {
		return err
	}

	rbacIDs := append([]string{pluginID}, childIDs...)
	if err := m.rbacCleaner.CleanupPluginRBAC(ctx, rbacIDs...); err != nil {
		m.log.Error("Failed to cleanup plugin RBAC. Stale RBAC data can be cleaned up on next startup by setting the cfg.RBAC.PluginsCleanup config option", "pluginIds", rbacIDs, "error", err)
	}

	for _, childID := range childIDs {
		if err := m.removeExternalService(ctx, childID); err != nil {
			m.log.Error("Failed to remove nested plugin external service", "pluginId", childID, "parentId", pluginID, "error", err)
		}
	}

	return m.removeExternalService(ctx, pluginID)
}

// unloadAndDelete unloads the plugin and its nested children and deletes its files, returning the
// IDs of the unloaded children.
func (m *PluginInstaller) unloadAndDelete(ctx context.Context, pluginID, version string) ([]string, error) {
	plugin, exists := m.plugin(ctx, pluginID, version)
	if !exists {
		return nil, plugins.ErrPluginNotInstalled
	}

	if plugin.IsCorePlugin() {
		return nil, plugins.ErrUninstallCorePlugin
	}

	// Unload nested plugins so they release files, then let the parent Remove
	// delete the tree. Removing each child directory first can leave the
	// parent half-deleted if a later child fails.
	childIDs, err := m.unload(ctx, plugin)
	if err != nil {
		return nil, err
	}

	if remover, ok := plugin.FS.(plugins.FSRemover); ok {
		if err = remover.Remove(); err != nil {
			return nil, err
		}
	}

	return childIDs, nil
}

// unload unloads the plugin and its nested children, returning the IDs of the unloaded children.
func (m *PluginInstaller) unload(ctx context.Context, plugin *plugins.Plugin) ([]string, error) {
	var childIDs []string
	for _, child := range plugin.Children {
		if child == nil {
			continue
		}
		// The registry resolves by ID and alias, so only unload the entry that
		// is this exact child and never an unrelated plugin sharing its ID.
		registered, exists := m.plugin(ctx, child.ID, child.Info.Version)
		if !exists || registered != child {
			continue
		}
		if _, err := m.pluginLoader.Unload(ctx, child); err != nil {
			return nil, err
		}
		childIDs = append(childIDs, child.ID)
	}

	if _, err := m.pluginLoader.Unload(ctx, plugin); err != nil {
		return nil, err
	}

	return childIDs, nil
}

func (m *PluginInstaller) removeExternalService(ctx context.Context, pluginID string) error {
	has, err := m.serviceRegistry.HasExternalService(ctx, pluginID)
	if err == nil && has {
		return m.serviceRegistry.RemoveExternalService(ctx, pluginID)
	}
	return err
}

// plugin finds a plugin with `pluginID` from the store
func (m *PluginInstaller) plugin(ctx context.Context, pluginID, pluginVersion string) (*plugins.Plugin, bool) {
	p, exists := m.pluginRegistry.Plugin(ctx, pluginID, pluginVersion)
	if !exists {
		return nil, false
	}

	return p, true
}

func RepoCompatOpts(opts plugins.AddOpts) (repo.CompatOpts, error) {
	os := opts.OS()
	arch := opts.Arch()
	if len(os) == 0 || len(arch) == 0 {
		return repo.CompatOpts{}, errors.New("invalid system compatibility options provided")
	}

	grafanaVersion := opts.GrafanaVersion()
	if len(grafanaVersion) == 0 {
		return repo.NewSystemCompatOpts(os, arch), nil
	}

	return repo.NewCompatOpts(grafanaVersion, os, arch), nil
}
