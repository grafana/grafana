package updatechecker

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"strings"
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

	HasUpdate     bool
	LatestVersion string
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
	if !s.cfg.CheckForUpdates {
		return
	}

	resp, err := httpClient.Get("https://raw.githubusercontent.com/grafana/grafana/main/latest.json")
	if err != nil {
		log.Warnf("Failed to get latest.json repo from github.com: %v", err.Error())
		return
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Warnf("Update check failed, reading response from github.com: %v", err.Error())
		return
	}

	var latest latestJSON
	err = json.Unmarshal(body, &latest)
	if err != nil {
		log.Warnf("Failed to unmarshal latest.json: %v", err.Error())
		return
	}

	if strings.Contains(s.cfg.BuildVersion, "-") {
		s.LatestVersion = latest.Testing
		s.HasUpdate = !strings.HasPrefix(s.cfg.BuildVersion, latest.Testing)
	} else {
		s.LatestVersion = latest.Stable
		s.HasUpdate = latest.Stable != s.cfg.BuildVersion
	}

	currVersion, err1 := version.NewVersion(s.cfg.BuildVersion)
	latestVersion, err2 := version.NewVersion(s.LatestVersion)
	if err1 == nil && err2 == nil {
		s.HasUpdate = currVersion.LessThan(latestVersion)
	}
}
