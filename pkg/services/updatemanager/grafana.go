package updatemanager

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/hashicorp/go-version"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

const grafanaStableVersionURL = "https://grafana.com/api/grafana/versions/stable"

type GrafanaService struct {
	hasUpdate     bool
	latestVersion string

	enabled        bool
	grafanaVersion string
	httpClient     httpClient
	mutex          sync.RWMutex
	log            log.Logger
	tracer         tracing.Tracer
}

func ProvideGrafanaService(cfg *setting.Cfg, tracer tracing.Tracer) (*GrafanaService, error) {
	logger := log.New("grafana.update.checker")
	cl, err := httpclient.New(httpclient.Options{
		Middlewares: []httpclient.Middleware{
			httpclientprovider.TracingMiddleware(logger, tracer),
		},
	})
	if err != nil {
		return nil, err
	}
	return &GrafanaService{
		enabled:        cfg.CheckForGrafanaUpdates,
		grafanaVersion: cfg.BuildVersion,
		httpClient:     cl,
		log:            logger,
		tracer:         tracer,
	}, nil
}

func (s *GrafanaService) IsDisabled() bool {
	return !s.enabled
}

func (s *GrafanaService) Run(ctx context.Context) error {
	s.instrumentedCheckForUpdates(ctx)

	ticker := time.NewTicker(time.Hour * 24)
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

func (s *GrafanaService) instrumentedCheckForUpdates(ctx context.Context) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "updatechecker.GrafanaService.checkForUpdates")
	defer span.End()
	ctxLogger := s.log.FromContext(ctx)
	if err := s.checkForUpdates(ctx); err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("update check failed: %s", err))
		span.RecordError(err)
		ctxLogger.Error("Update check failed", "error", err, "duration", time.Since(start))
		return
	}
	ctxLogger.Info("Update check succeeded", "duration", time.Since(start))
}

func (s *GrafanaService) checkForUpdates(ctx context.Context) error {
	ctxLogger := s.log.FromContext(ctx)
	ctxLogger.Debug("Checking for updates")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, grafanaStableVersionURL, nil)
	if err != nil {
		return err
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to get stable version from grafana.com: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			ctxLogger.Warn("Failed to close response body", "err", err)
		}
	}()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("update check failed, reading response from grafana.com: %w", err)
	}

	type grafanaVersionJSON struct {
		Version string `json:"version"`
	}
	var latest grafanaVersionJSON
	err = json.Unmarshal(body, &latest)
	if err != nil {
		return fmt.Errorf("failed to unmarshal response from grafana.com: %w", err)
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()
	// only check for updates in stable versions
	if !strings.Contains(s.grafanaVersion, "-") {
		s.latestVersion = latest.Version
		s.hasUpdate = latest.Version != s.grafanaVersion
	}

	currVersion, err1 := version.NewVersion(s.grafanaVersion)
	latestVersion, err2 := version.NewVersion(s.latestVersion)
	if err1 == nil && err2 == nil {
		s.hasUpdate = currVersion.LessThan(latestVersion)
	}

	return nil
}

func (s *GrafanaService) UpdateAvailable() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.hasUpdate
}

func (s *GrafanaService) LatestVersion() string {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.latestVersion
}
