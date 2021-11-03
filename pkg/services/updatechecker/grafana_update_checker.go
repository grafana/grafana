package updatechecker

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/hashicorp/go-version"
)

var (
	httpClient = http.Client{Timeout: 10 * time.Second}
	logger     = log.New("update.checker")
)

type latestJSON struct {
	Stable  string `json:"stable"`
	Testing string `json:"testing"`
}

type Service struct {
	cfg *setting.Cfg

	hasUpdate     bool
	latestVersion string
	mutex         sync.RWMutex
}

func ProvideService(cfg *setting.Cfg) *Service {
	s := newUpdateChecker(cfg)

	return s
}

func newUpdateChecker(cfg *setting.Cfg) *Service {
	return &Service{
		cfg: cfg,
	}
}

func (s *Service) IsDisabled() bool {
	return !s.cfg.CheckForUpdates
}

func (s *Service) Run(ctx context.Context) error {
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

func (s *Service) checkForUpdates() {
	resp, err := httpClient.Get("https://raw.githubusercontent.com/grafana/grafana/main/latest.json")
	if err != nil {
		logger.Debug("Failed to get latest.json repo from github.com", "error", err)
		return
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		logger.Debug("Update check failed, reading response from github.com", "error", err)
		return
	}

	var latest latestJSON
	err = json.Unmarshal(body, &latest)
	if err != nil {
		logger.Debug("Failed to unmarshal latest.json", "error", err)
		return
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()
	if strings.Contains(s.cfg.BuildVersion, "-") {
		s.latestVersion = latest.Testing
		s.hasUpdate = !strings.HasPrefix(s.cfg.BuildVersion, latest.Testing)
	} else {
		s.latestVersion = latest.Stable
		s.hasUpdate = latest.Stable != s.cfg.BuildVersion
	}

	currVersion, err1 := version.NewVersion(s.cfg.BuildVersion)
	latestVersion, err2 := version.NewVersion(s.latestVersion)
	if err1 == nil && err2 == nil {
		s.hasUpdate = currVersion.LessThan(latestVersion)
	}
}

func (s *Service) GrafanaUpdateAvailable() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.hasUpdate
}

func (s *Service) LatestGrafanaVersion() string {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.latestVersion
}
