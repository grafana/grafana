package updatechecker

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/hashicorp/go-version"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

type GrafanaService struct {
	hasUpdate     bool
	latestVersion string

	enabled        bool
	grafanaVersion string
	httpClient     http.Client
	mutex          sync.RWMutex
	log            log.Logger
}

func ProvideGrafanaService(cfg *setting.Cfg) *GrafanaService {
	return &GrafanaService{
		enabled:        cfg.CheckForGrafanaUpdates,
		grafanaVersion: cfg.BuildVersion,
		httpClient:     http.Client{Timeout: 10 * time.Second},
		log:            log.New("grafana.update.checker"),
	}
}

func (s *GrafanaService) IsDisabled() bool {
	return !s.enabled
}

func (s *GrafanaService) Run(ctx context.Context) error {
	s.checkForUpdates()

	ticker := time.NewTicker(time.Minute * 10)
	run := true

	for run {
		select {
		case <-ticker.C:
			s.checkForUpdates()
		case <-ctx.Done():
			run = false
		}
	}

	return ctx.Err()
}

func (s *GrafanaService) checkForUpdates() {
	resp, err := s.httpClient.Get("https://raw.githubusercontent.com/grafana/grafana/main/latest.json")
	if err != nil {
		s.log.Debug("Failed to get latest.json repo from github.com", "error", err)
		return
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			s.log.Warn("Failed to close response body", "err", err)
		}
	}()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		s.log.Debug("Update check failed, reading response from github.com", "error", err)
		return
	}

	type latestJSON struct {
		Stable  string `json:"stable"`
		Testing string `json:"testing"`
	}
	var latest latestJSON
	err = json.Unmarshal(body, &latest)
	if err != nil {
		s.log.Debug("Failed to unmarshal latest.json", "error", err)
		return
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()
	if strings.Contains(s.grafanaVersion, "-") {
		s.latestVersion = latest.Testing
		s.hasUpdate = !strings.HasPrefix(s.grafanaVersion, latest.Testing)
	} else {
		s.latestVersion = latest.Stable
		s.hasUpdate = latest.Stable != s.grafanaVersion
	}

	currVersion, err1 := version.NewVersion(s.grafanaVersion)
	latestVersion, err2 := version.NewVersion(s.latestVersion)
	if err1 == nil && err2 == nil {
		s.hasUpdate = currVersion.LessThan(latestVersion)
	}
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
