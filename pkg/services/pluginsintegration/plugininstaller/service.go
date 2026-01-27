package plugininstaller

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

const ServiceName = "plugin.backgroundinstaller"

var (
	installRequestCounter = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "plugins",
		Name:      "preinstall_total",
		Help:      "The total amount of plugin preinstallations",
	}, []string{"plugin_id", "version"})

	installRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "plugins",
		Name:      "preinstall_duration_seconds",
		Help:      "Plugin preinstallation duration",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
	}, []string{"plugin_id", "version"})

	once sync.Once
)

type Service struct {
	services.NamedService
	cfg             *setting.Cfg
	log             log.Logger
	pluginInstaller plugins.Installer
	pluginStore     pluginstore.Store
	pluginRepo      repo.Service
	pluginLoader    loader.Service
	updateChecker   pluginchecker.PluginUpdateChecker
	installComplete chan struct{} // closed when all plugins are installed (used for testing)
}

func ProvideService(
	cfg *setting.Cfg,
	pluginStore pluginstore.Store,
	pluginInstaller plugins.Installer,
	promReg prometheus.Registerer,
	pluginRepo repo.Service,
	pluginLoader loader.Service,
	updateChecker pluginchecker.PluginUpdateChecker,
) (*Service, error) {
	once.Do(func() {
		promReg.MustRegister(installRequestCounter)
		promReg.MustRegister(installRequestDuration)
	})

	s := &Service{
		log:             log.New(ServiceName),
		cfg:             cfg,
		pluginInstaller: pluginInstaller,
		pluginStore:     pluginStore,
		pluginRepo:      pluginRepo,
		pluginLoader:    pluginLoader,
		updateChecker:   updateChecker,
		installComplete: make(chan struct{}),
	}

	s.NamedService = services.NewBasicService(s.starting, s.running, nil).WithName(ServiceName)

	return s, nil
}

// IsDisabled disables background installation of plugins.
func (s *Service) IsDisabled() bool {
	return len(s.cfg.PreinstallPluginsAsync) == 0
}

func (s *Service) shouldUpdate(ctx context.Context, pluginID, currentVersion string, pluginURL string) bool {
	// If the plugin is installed from a URL, we cannot check for updates as we do not have the version information
	// from the repository. Therefore, we assume that the plugin should be updated if the URL is provided.
	if pluginURL != "" {
		return true
	}
	info, err := s.pluginRepo.GetPluginArchiveInfo(ctx, pluginID, "", repo.NewCompatOpts(s.cfg.BuildVersion, runtime.GOOS, runtime.GOARCH))
	if err != nil {
		s.log.Error("Failed to get plugin info", "pluginId", pluginID, "error", err)
		return false
	}

	return s.updateChecker.CanUpdate(pluginID, currentVersion, info.Version, true)
}

func (s *Service) installPlugins(ctx context.Context, pluginsToInstall []setting.InstallPlugin, failOnErr bool) error {
	for _, installPlugin := range pluginsToInstall {
		// Check if the plugin is already installed
		p, exists := s.pluginStore.Plugin(ctx, installPlugin.ID)
		if exists {
			// If it's installed, check if we are looking for a specific version
			if p.Info.Version == installPlugin.Version {
				s.log.Debug("Plugin already installed", "pluginId", installPlugin.ID, "version", installPlugin.Version)
				continue
			}
			if installPlugin.Version == "" {
				if !s.cfg.PreinstallAutoUpdate {
					// Skip updating the plugin if auto-update is disabled
					continue
				}
				// The plugin is installed but it's not pinned to a specific version
				// Check if there is a newer version available
				if !s.shouldUpdate(ctx, installPlugin.ID, p.Info.Version, installPlugin.URL) {
					continue
				}
			}
		}

		s.log.Info("Installing plugin", "pluginId", installPlugin.ID, "version", installPlugin.Version)
		start := time.Now()
		ctx = repo.WithRequestOrigin(ctx, "preinstall")
		compatOpts := plugins.NewAddOpts(s.cfg.BuildVersion, runtime.GOOS, runtime.GOARCH, installPlugin.URL)
		err := s.pluginInstaller.Add(ctx, installPlugin.ID, installPlugin.Version, compatOpts)
		if err != nil {
			var dupeErr plugins.DuplicateError
			if errors.As(err, &dupeErr) {
				s.log.Debug("Plugin already installed", "pluginId", installPlugin.ID, "version", installPlugin.Version)
				continue
			}

			// Try to load from bundled plugins directory as a fallback for default preinstall plugins
			if setting.IsDefaultPreinstallPlugin(installPlugin.ID) && s.tryLoadFromBundled(ctx, installPlugin.ID) {
				s.log.Info("Plugin loaded from bundled directory", "pluginId", installPlugin.ID)
				continue
			}

			if failOnErr {
				// Halt execution in the synchronous scenario
				return fmt.Errorf("failed to install plugin %s@%s: %w", installPlugin.ID, installPlugin.Version, err)
			}
			s.log.Error("Failed to install plugin", "pluginId", installPlugin.ID, "version", installPlugin.Version, "error", err)
			continue
		}
		elapsed := time.Since(start)
		s.log.Info("Plugin successfully installed", "pluginId", installPlugin.ID, "version", installPlugin.Version, "duration", elapsed)
		installRequestDuration.WithLabelValues(installPlugin.ID, installPlugin.Version).Observe(elapsed.Seconds())
		installRequestCounter.WithLabelValues(installPlugin.ID, installPlugin.Version).Inc()
	}

	return nil
}

// tryLoadFromBundled attempts to load a plugin from the bundled plugins directory.
// Returns true if the plugin was successfully loaded, false otherwise.
func (s *Service) tryLoadFromBundled(ctx context.Context, pluginID string) bool {
	if s.cfg.BundledPluginsPath == "" {
		return false
	}

	bundledPath := filepath.Join(s.cfg.BundledPluginsPath, pluginID)
	if _, err := os.Stat(bundledPath); os.IsNotExist(err) {
		s.log.Debug("Plugin not found in bundled directory", "pluginId", pluginID, "path", bundledPath)
		return false
	}

	s.log.Info("Attempting to load plugin from bundled directory", "pluginId", pluginID, "path", bundledPath)
	loadedPlugins, err := s.pluginLoader.Load(ctx, sources.NewLocalSource(plugins.ClassExternal, []string{bundledPath}))
	if err != nil {
		s.log.Error("Failed to load plugin from bundled directory", "pluginId", pluginID, "path", bundledPath, "error", err)
		return false
	}

	return len(loadedPlugins) > 0
}

func (s *Service) starting(ctx context.Context) error {
	if len(s.cfg.PreinstallPluginsSync) > 0 {
		s.log.Info("Installing plugins", "plugins", s.cfg.PreinstallPluginsSync)
		if err := s.installPlugins(ctx, s.cfg.PreinstallPluginsSync, true); err != nil {
			s.log.Error("Failed to install plugins", "error", err)
			return err
		}
	}
	s.log.Info("Plugins installed", "plugins", s.cfg.PreinstallPluginsSync)
	return nil
}

func (s *Service) running(ctx context.Context) error {
	if len(s.cfg.PreinstallPluginsAsync) > 0 {
		s.log.Info("Installing plugins", "plugins", s.cfg.PreinstallPluginsAsync)
		if err := s.installPlugins(ctx, s.cfg.PreinstallPluginsAsync, false); err != nil {
			s.log.Error("Failed to install plugins", "error", err)
			return err
		}
	}
	close(s.installComplete)
	<-ctx.Done()
	return nil
}

func (s *Service) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(ctx)
}
