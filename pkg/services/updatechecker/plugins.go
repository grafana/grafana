package updatechecker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/hashicorp/go-version"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type PluginsService struct {
	availableUpdates map[string]string

	enabled        bool
	grafanaVersion string
	pluginStore    plugins.Store
	httpClient     httpClient
	mutex          sync.RWMutex
	log            log.Logger
	tracer         tracing.Tracer
}

func ProvidePluginsService(cfg *setting.Cfg, pluginStore plugins.Store, tracer tracing.Tracer) (*PluginsService, error) {
	logger := log.New("plugins.update.checker")
	cl, err := httpclient.New(httpclient.Options{
		Middlewares: []httpclient.Middleware{
			httpclientprovider.TracingMiddleware(logger, tracer),
		},
	})
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
		availableUpdates: make(map[string]string),
	}, nil
}

func (s *PluginsService) IsDisabled() bool {
	return !s.enabled
}

func (s *PluginsService) Run(ctx context.Context) error {
	s.instrumentedCheckForUpdates(ctx)

	ticker := time.NewTicker(time.Minute * 10)
	run := true

	for run {
		select {
		case <-ticker.C:
			s.instrumentedCheckForUpdates(ctx)
		case <-ctx.Done():
			run = false
		}
	}

	return ctx.Err()
}

func (s *PluginsService) HasUpdate(ctx context.Context, pluginID string) (string, bool) {
	s.mutex.RLock()
	updateVers, updateAvailable := s.availableUpdates[pluginID]
	s.mutex.RUnlock()
	if updateAvailable {
		// check if plugin has already been updated since the last invocation of `checkForUpdates`
		plugin, exists := s.pluginStore.Plugin(ctx, pluginID)
		if !exists {
			return "", false
		}

		if canUpdate(plugin.Info.Version, updateVers) {
			return updateVers, true
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
	ctxLogger.Debug("Checking for updates")
	localPlugins := s.pluginsEligibleForVersionCheck(ctx)
	requestURL := "https://grafana.com/api/plugins/versioncheck?" + url.Values{
		"slugIn":         []string{s.pluginIDsCSV(localPlugins)},
		"grafanaVersion": []string{s.grafanaVersion},
	}.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
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

	availableUpdates := map[string]string{}
	for _, gcomP := range gcomPlugins {
		if localP, exists := localPlugins[gcomP.Slug]; exists {
			if canUpdate(localP.Info.Version, gcomP.Version) {
				availableUpdates[localP.ID] = gcomP.Version
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

func canUpdate(v1, v2 string) bool {
	ver1, err1 := version.NewVersion(v1)
	if err1 != nil {
		return false
	}
	ver2, err2 := version.NewVersion(v2)
	if err2 != nil {
		return false
	}

	return ver1.LessThan(ver2)
}

func (s *PluginsService) pluginIDsCSV(m map[string]plugins.PluginDTO) string {
	ids := make([]string, 0, len(m))
	for pluginID := range m {
		ids = append(ids, pluginID)
	}

	return strings.Join(ids, ",")
}

func (s *PluginsService) pluginsEligibleForVersionCheck(ctx context.Context) map[string]plugins.PluginDTO {
	result := make(map[string]plugins.PluginDTO)
	for _, p := range s.pluginStore.Plugins(ctx) {
		if p.IsCorePlugin() {
			continue
		}
		result[p.ID] = p
	}

	return result
}
