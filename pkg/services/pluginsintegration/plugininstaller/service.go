package plugininstaller

import (
	"context"
	"errors"
	"fmt"
	"runtime"
	"sync"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

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
	cfg             *setting.Cfg
	log             log.Logger
	pluginInstaller plugins.Installer
	pluginStore     pluginstore.Store
	pluginRepo      repo.Service
	features        featuremgmt.FeatureToggles
	failOnErr       bool
}

func ProvideService(
	cfg *setting.Cfg,
	pluginStore pluginstore.Store,
	pluginInstaller plugins.Installer,
	promReg prometheus.Registerer,
	pluginRepo repo.Service,
	features featuremgmt.FeatureToggles,
) (*Service, error) {
	once.Do(func() {
		promReg.MustRegister(installRequestCounter)
		promReg.MustRegister(installRequestDuration)
	})

	s := &Service{
		log:             log.New("plugin.backgroundinstaller"),
		cfg:             cfg,
		pluginInstaller: pluginInstaller,
		pluginStore:     pluginStore,
		failOnErr:       !cfg.PreinstallPluginsAsync, // Fail on error if preinstall is synchronous
		pluginRepo:      pluginRepo,
		features:        features,
	}
	if !cfg.PreinstallPluginsAsync {
		// Block initialization process until plugins are installed
		err := s.installPluginsWithTimeout()
		if err != nil {
			return nil, err
		}
	}
	return s, nil
}

// IsDisabled disables background installation of plugins.
func (s *Service) IsDisabled() bool {
	return len(s.cfg.PreinstallPlugins) == 0 ||
		!s.cfg.PreinstallPluginsAsync
}

func (s *Service) installPluginsWithTimeout() error {
	// Installation process does not timeout by default nor reuses the context
	// passed to the request so we need to handle the timeout here.
	// We could make this timeout configurable in the future.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	done := make(chan struct{ err error })
	go func() {
		done <- struct{ err error }{err: s.installPlugins(ctx)}
	}()
	select {
	case <-ctx.Done():
		return fmt.Errorf("failed to install plugins: %w", ctx.Err())
	case d := <-done:
		return d.err
	}
}

func (s *Service) shouldUpdate(ctx context.Context, pluginID, currentVersion string) bool {
	info, err := s.pluginRepo.GetPluginArchiveInfo(ctx, pluginID, "", repo.NewCompatOpts(s.cfg.BuildVersion, runtime.GOOS, runtime.GOARCH))
	if err != nil {
		s.log.Error("Failed to get plugin info", "pluginId", pluginID, "error", err)
		return false
	}

	// If we are already on the latest version, skip the installation
	if info.Version == currentVersion {
		s.log.Debug("Latest plugin already installed", "pluginId", pluginID, "version", info.Version)
		return false
	}

	// If the latest version is a new major version, skip the installation
	parsedLatestVersion, err := semver.NewVersion(info.Version)
	if err != nil {
		s.log.Error("Failed to parse latest version, skipping potential update", "pluginId", pluginID, "version", info.Version, "error", err)
		return false
	}
	parsedCurrentVersion, err := semver.NewVersion(currentVersion)
	if err != nil {
		s.log.Error("Failed to parse current version, skipping potential update", "pluginId", pluginID, "version", currentVersion, "error", err)
		return false
	}
	if parsedLatestVersion.Major() > parsedCurrentVersion.Major() {
		s.log.Debug("New major version available, skipping update due to possible breaking changes", "pluginId", pluginID, "version", info.Version)
		return false
	}

	// We should update the plugin
	return true
}

func (s *Service) installPlugins(ctx context.Context) error {
	for _, installPlugin := range s.cfg.PreinstallPlugins {
		// Check if the plugin is already installed
		p, exists := s.pluginStore.Plugin(ctx, installPlugin.ID)
		if exists {
			// If it's installed, check if we are looking for a specific version
			if p.Info.Version == installPlugin.Version {
				s.log.Debug("Plugin already installed", "pluginId", installPlugin.ID, "version", installPlugin.Version)
				continue
			}
			if installPlugin.Version == "" {
				if !s.features.IsEnabled(ctx, featuremgmt.FlagPreinstallAutoUpdate) {
					// Skip updating the plugin if the feature flag is disabled
					continue
				}
				// The plugin is installed but it's not pinned to a specific version
				// Check if there is a newer version available
				if !s.shouldUpdate(ctx, installPlugin.ID, p.Info.Version) {
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
			if s.failOnErr {
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

func (s *Service) Run(ctx context.Context) error {
	err := s.installPlugins(ctx)
	if err != nil {
		// Unexpected error, asynchronous installation should not return errors
		s.log.Error("Failed to install plugins", "error", err)
	}
	return nil
}
