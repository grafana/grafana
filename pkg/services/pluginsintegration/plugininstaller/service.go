package plugininstaller

import (
	"context"
	"errors"
	"fmt"
	"runtime"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
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
	features        featuremgmt.FeatureToggles
	log             log.Logger
	pluginInstaller plugins.Installer
	pluginStore     pluginstore.Store
	failOnErr       bool
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, pluginStore pluginstore.Store, pluginInstaller plugins.Installer, promReg prometheus.Registerer) (*Service, error) {
	once.Do(func() {
		promReg.MustRegister(installRequestCounter)
		promReg.MustRegister(installRequestDuration)
	})

	s := &Service{
		features:        features,
		log:             log.New("plugin.backgroundinstaller"),
		cfg:             cfg,
		pluginInstaller: pluginInstaller,
		pluginStore:     pluginStore,
		failOnErr:       !cfg.PreinstallPluginsAsync, // Fail on error if preinstall is synchronous
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
	return !s.features.IsEnabled(context.Background(), featuremgmt.FlagBackgroundPluginInstaller) ||
		len(s.cfg.PreinstallPlugins) == 0 ||
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

func (s *Service) installPlugins(ctx context.Context) error {
	compatOpts := plugins.NewCompatOpts(s.cfg.BuildVersion, runtime.GOOS, runtime.GOARCH)

	for _, installPlugin := range s.cfg.PreinstallPlugins {
		// Check if the plugin is already installed
		p, exists := s.pluginStore.Plugin(ctx, installPlugin.ID)
		if exists {
			// If it's installed, check if we are looking for a specific version
			if installPlugin.Version == "" || p.Info.Version == installPlugin.Version {
				s.log.Debug("Plugin already installed", "pluginId", installPlugin.ID, "version", installPlugin.Version)
				continue
			}
		}

		s.log.Info("Installing plugin", "pluginId", installPlugin.ID, "version", installPlugin.Version)
		start := time.Now()
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
