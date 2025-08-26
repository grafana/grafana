package updatemanager

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

type availableUpdate struct {
	localVersion     string
	availableVersion string
}

type PluginsService struct {
	availableUpdates map[string]availableUpdate

	enabled         bool
	grafanaVersion  string
	pluginStore     pluginstore.Store
	httpClient      httpClient
	mutex           sync.RWMutex
	log             log.Logger
	tracer          tracing.Tracer
	updateCheckURL  *url.URL
	pluginInstaller plugins.Installer
	updateChecker   *pluginchecker.Service
	updateStrategy  string

	features featuremgmt.FeatureToggles
}

func ProvidePluginsService(cfg *setting.Cfg,
	pluginStore pluginstore.Store,
	pluginInstaller plugins.Installer,
	tracer tracing.Tracer,
	features featuremgmt.FeatureToggles,
	updateChecker *pluginchecker.Service,
) (*PluginsService, error) {
	logger := log.New("plugins.update.checker")
	cl, err := httpclient.New(httpclient.Options{
		Middlewares: []httpclient.Middleware{
			httpclientprovider.TracingMiddleware(logger, tracer),
		},
	})
	if err != nil {
		return nil, err
	}

	updateCheckURL, err := url.JoinPath(cfg.GrafanaComAPIURL, "plugins", "versioncheck")
	if err != nil {
		return nil, err
	}

	parsedUpdateCheckURL, err := url.Parse(updateCheckURL)
	if err != nil {
		return nil, err
	}

	return &PluginsService{
		enabled:          cfg.CheckForPluginUpdates,
		grafanaVersion:   cfg.BuildVersion,
		httpClient:       cl,
		log:              logger,
		tracer:           tracer,
		pluginStore:      pluginStore,
		availableUpdates: make(map[string]availableUpdate),
		updateCheckURL:   parsedUpdateCheckURL,
		pluginInstaller:  pluginInstaller,
		features:         features,
		updateChecker:    updateChecker,
		updateStrategy:   cfg.PluginUpdateStrategy,
	}, nil
}

func (s *PluginsService) IsDisabled() bool {
	return !s.enabled
}

func (s *PluginsService) Run(ctx context.Context) error {
	s.instrumentedCheckForUpdates(ctx)
	if s.features.IsEnabledGlobally(featuremgmt.FlagPluginsAutoUpdate) {
		s.updateAll(ctx)
	}

	ticker := time.NewTicker(time.Minute * 10)
	run := true

	for run {
		select {
		case <-ticker.C:
			s.instrumentedCheckForUpdates(ctx)
			if s.features.IsEnabledGlobally(featuremgmt.FlagPluginsAutoUpdate) {
				s.updateAll(ctx)
			}
		case <-ctx.Done():
			run = false
		}
	}

	return ctx.Err()
}

func (s *PluginsService) HasUpdate(ctx context.Context, pluginID string) (string, bool) {
	s.mutex.RLock()
	update, updateAvailable := s.availableUpdates[pluginID]
	s.mutex.RUnlock()
	if updateAvailable {
		// check if plugin has already been updated since the last invocation of `checkForUpdates`
		plugin, exists := s.pluginStore.Plugin(ctx, pluginID)
		if !exists {
			return "", false
		}

		if s.canUpdate(ctx, plugin, update.availableVersion) {
			return update.availableVersion, true
		}
	}

	return "", false
}

func (s *PluginsService) instrumentedCheckForUpdates(ctx context.Context) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "updatechecker.PluginsService.checkForUpdates")
	defer span.End()
	ctxLogger := s.log.FromContext(ctx)
	if err := s.checkForUpdates(ctx); err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("update check failed: %s", err))
		span.RecordError(err)
		ctxLogger.Debug("Update check failed", "error", err, "duration", time.Since(start))
		return
	}
	ctxLogger.Info("Update check succeeded", "duration", time.Since(start))
}

func (s *PluginsService) checkForUpdates(ctx context.Context) error {
	ctxLogger := s.log.FromContext(ctx)
	ctxLogger.Debug("Preparing plugins eligible for version check")
	localPlugins := s.pluginsEligibleForVersionCheck(ctx)
	requestURL := s.updateCheckURL
	requestURLParameters := requestURL.Query()
	requestURLParameters.Set("slugIn", s.pluginIDsCSV((localPlugins)))
	requestURLParameters.Set("grafanaVersion", s.grafanaVersion)
	requestURL.RawQuery = requestURLParameters.Encode()

	ctxLogger.Debug("Checking for plugin updates", "url", requestURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL.String(), nil)
	if err != nil {
		return err
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to get plugins repo from grafana.com: %w", err)
	}
	defer func() {
		err = resp.Body.Close()
		if err != nil {
			ctxLogger.Warn("Failed to close response body", "err", err)
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response from grafana.com: %w", err)
	}

	type gcomPlugin struct {
		Slug    string `json:"slug"`
		Version string `json:"version"`
	}
	var gcomPlugins []gcomPlugin
	err = json.Unmarshal(body, &gcomPlugins)
	if err != nil {
		return fmt.Errorf("failed to unmarshal plugin repo, reading response from grafana.com: %w", err)
	}

	availableUpdates := make(map[string]availableUpdate)

	for _, gcomP := range gcomPlugins {
		if localP, exists := localPlugins[gcomP.Slug]; exists {
			if s.canUpdate(ctx, localP, gcomP.Version) {
				availableUpdates[localP.ID] = availableUpdate{
					localVersion:     localP.Info.Version,
					availableVersion: gcomP.Version,
				}
			}
		}
	}

	if len(availableUpdates) > 0 {
		s.mutex.Lock()
		s.availableUpdates = availableUpdates
		s.mutex.Unlock()
	}

	return nil
}

func (s *PluginsService) canUpdate(ctx context.Context, plugin pluginstore.Plugin, gcomVersion string) bool {
	if !s.updateChecker.IsUpdatable(ctx, plugin) {
		return false
	}

	if plugin.Info.Version == gcomVersion {
		return false
	}

	if s.features.IsEnabledGlobally(featuremgmt.FlagPluginsAutoUpdate) {
		return s.updateChecker.CanUpdate(plugin.ID, plugin.Info.Version, gcomVersion, s.updateStrategy == setting.PluginUpdateStrategyMinor)
	}

	return s.updateChecker.CanUpdate(plugin.ID, plugin.Info.Version, gcomVersion, false)
}

func (s *PluginsService) pluginIDsCSV(m map[string]pluginstore.Plugin) string {
	ids := make([]string, 0, len(m))
	for pluginID := range m {
		ids = append(ids, pluginID)
	}

	return strings.Join(ids, ",")
}

func (s *PluginsService) pluginsEligibleForVersionCheck(ctx context.Context) map[string]pluginstore.Plugin {
	result := make(map[string]pluginstore.Plugin)
	for _, p := range s.pluginStore.Plugins(ctx) {
		if p.IsCorePlugin() {
			continue
		}
		result[p.ID] = p
	}

	return result
}
func (s *PluginsService) updateAll(ctx context.Context) {
	ctxLogger := s.log.FromContext(ctx)

	failedUpdates := make(map[string]availableUpdate)

	for pluginID, availableUpdate := range s.availableUpdates {
		compatOpts := plugins.NewAddOpts(s.grafanaVersion, runtime.GOOS, runtime.GOARCH, "")

		ctxLogger.Info("Auto updating plugin", "pluginID", pluginID, "from", availableUpdate.localVersion, "to", availableUpdate.availableVersion)

		err := s.pluginInstaller.Add(ctx, pluginID, availableUpdate.availableVersion, compatOpts)
		if err != nil {
			ctxLogger.Error("Failed to auto update plugin", "pluginID", pluginID, "from", availableUpdate.localVersion, "to", availableUpdate.availableVersion, "error", err)
			failedUpdates[pluginID] = availableUpdate
		}
	}

	s.mutex.Lock()
	s.availableUpdates = failedUpdates
	s.mutex.Unlock()
}
