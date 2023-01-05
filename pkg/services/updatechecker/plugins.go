package updatechecker

import (
	"context"
	"encoding/json"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	"go.opentelemetry.io/otel/trace"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/hashicorp/go-version"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	pluginUpdaterRequestTotal = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "plugin_updater_request_total",
		Help:      "The total number of plugin updater update requests",
	})
	pluginUpdaterRequestFailureTotal = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "plugin_updater_request_failure_total",
		Help:      "The total number of failed plugin updater update requests",
	})
	pluginUpdaterRequestDurationSeconds = promauto.NewHistogram(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "plugin_updater_request_duration_seconds",
		Help:      "Plugin updater request duration",
	})
	pluginUpdaterInFlightRequest = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "grafana",
		Name:      "plugin_updater_in_flight_request_total",
		Help:      "Plugin updater request currently in progress",
	})
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

func ProvidePluginsService(cfg *setting.Cfg, pluginStore plugins.Store, tracer tracing.Tracer) *PluginsService {
	return &PluginsService{
		enabled:          cfg.CheckForPluginUpdates,
		grafanaVersion:   cfg.BuildVersion,
		httpClient:       &http.Client{Timeout: 10 * time.Second},
		log:              log.New("plugins.update.checker"),
		tracer:           tracer,
		pluginStore:      pluginStore,
		availableUpdates: make(map[string]string),
	}
}

type httpClient interface {
	// TODO: change this so it accepts context (for tracing)
	Get(url string) (resp *http.Response, err error)
}

func (s *PluginsService) IsDisabled() bool {
	return !s.enabled
}

func (s *PluginsService) Run(ctx context.Context) error {
	s.checkForUpdates(ctx)

	ticker := time.NewTicker(time.Minute * 10)
	run := true

	for run {
		select {
		case <-ticker.C:
			s.checkForUpdates(ctx)
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

func (s *PluginsService) checkForUpdates(ctx context.Context) {
	var err error

	ctx, span := s.tracer.Start(ctx, "updatechecker.PluginsService.checkForUpdates")
	defer span.End()

	traceID := tracing.TraceIDFromContext(ctx, false)
	traceIDLogOpts := []interface{}{"traceID", traceID}
	s.log.Debug("Checking for updates", traceIDLogOpts...)

	startTime := time.Now()
	pluginUpdaterInFlightRequest.Inc()
	defer func() {
		pluginUpdaterInFlightRequest.Dec()
		pluginUpdaterRequestTotal.Inc()
		pluginUpdaterRequestDurationSeconds.Observe(time.Since(startTime).Seconds())

		if err != nil {
			pluginUpdaterRequestFailureTotal.Inc()
			span.RecordError(err)
			s.log.Debug("Update check failed", traceIDLogOpts...)
		} else {
			s.log.Debug("Update check succeeded", traceIDLogOpts...)
		}
	}()

	localPlugins := s.pluginsEligibleForVersionCheck(ctx)

	// TODO: move all http-related tracing to a new struct implementing the httpClient interface
	url := "https://grafana.com/api/plugins/versioncheck?slugIn=" +
		s.pluginIDsCSV(localPlugins) + "&grafanaVersion=" + s.grafanaVersion
	_, requestSpan := s.tracer.Start(
		ctx,
		"updatechecker.PluginsService.gcomAPIRequest",
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			semconv.HTTPMethodKey.String(http.MethodGet),
			semconv.HTTPTargetKey.String(url),
		),
	)
	resp, err := s.httpClient.Get(url)
	if err != nil {
		requestSpan.RecordError(err)
		requestSpan.End()
		s.log.Debug("Failed to get plugins repo from grafana.com", "error", err.Error())
		return
	}
	requestSpan.SetAttributes(string(semconv.HTTPStatusCodeKey), resp.StatusCode, semconv.HTTPStatusCodeKey.Int(resp.StatusCode))
	requestSpan.End()
	defer func() {
		err = resp.Body.Close()
		if err != nil {
			s.log.Warn("Failed to close response body", "err", err)
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		s.log.Debug("Update check failed, reading response from grafana.com", "error", err.Error())
		return
	}

	type gcomPlugin struct {
		Slug    string `json:"slug"`
		Version string `json:"version"`
	}
	var gcomPlugins []gcomPlugin
	err = json.Unmarshal(body, &gcomPlugins)
	if err != nil {
		s.log.Debug("Failed to unmarshal plugin repo, reading response from grafana.com", "error", err.Error())
		return
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
