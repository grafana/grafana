package pluginscorecard

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginscoring"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	kvNamespace      = "plugin-scorecard"
	cacheTTL         = 7 * 24 * time.Hour
	httpTimeout      = 30 * time.Second
	scorecardAPIBase = "https://api.securityscorecards.dev/projects/"
)

var githubRepoRe = regexp.MustCompile(`^https://github\.com/([^/]+/[^/]+?)(?:\.git)?/?$`)

// Service fetches and caches OpenSSF Scorecard results, returning them as
// pluginscoring.CatalogPluginInsights — the stable Grafana-owned scoring schema.
type Service struct {
	pluginStore pluginstore.Store
	pluginRepo  repo.Service
	kvStore     *kvstore.NamespacedKVStore
	sidecarURL  string
	httpClient  *http.Client
	log         log.Logger
}

func ProvideService(
	cfg *setting.Cfg,
	pluginStore pluginstore.Store,
	pluginRepo repo.Service,
	kvStore kvstore.KVStore,
) *Service {
	return &Service{
		pluginStore: pluginStore,
		pluginRepo:  pluginRepo,
		kvStore:     kvstore.WithNamespace(kvStore, 0, kvNamespace),
		sidecarURL:  cfg.PluginScorecardSidecarURL,
		httpClient:  &http.Client{Timeout: httpTimeout},
		log:         log.New("plugins.scorecard"),
	}
}

// GetInsights returns scored Insights for a plugin, using kvstore cache when fresh.
func (s *Service) GetInsights(ctx context.Context, pluginID, version string) (*pluginscoring.CatalogPluginInsights, bool) {
	cacheKey := pluginID + "@" + version

	if raw, ok, err := s.kvStore.Get(ctx, cacheKey); err == nil && ok {
		var cached pluginscoring.ScorecardResult
		if json.Unmarshal([]byte(raw), &cached) == nil {
			if time.Since(cached.ScoredAt) < cacheTTL {
				insights := pluginscoring.FromScorecard(pluginID, version, &cached)
				return &insights, true
			}
		}
	}

	repoURL := s.repoURL(ctx, pluginID)
	if repoURL == "" {
		return nil, false
	}

	repoPath := githubRepoPath(repoURL)
	if repoPath == "" {
		return nil, false
	}

	result, err := s.fetch(ctx, repoPath)
	if err != nil {
		s.log.Warn("Failed to fetch scorecard", "plugin", pluginID, "repo", repoPath, "error", err)
		return nil, false
	}
	if result == nil {
		return nil, false
	}

	result.ScoredAt = time.Now().UTC()
	if raw, err := json.Marshal(result); err == nil {
		if err := s.kvStore.Set(ctx, cacheKey, string(raw)); err != nil {
			s.log.Warn("Failed to cache scorecard result", "plugin", pluginID, "error", err)
		}
	}

	insights := pluginscoring.FromScorecard(pluginID, version, result)
	return &insights, true
}

// Run refreshes scores for all installed plugins on startup and every 24h.
func (s *Service) Run(ctx context.Context) error {
	s.refresh(ctx)

	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.refresh(ctx)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (s *Service) refresh(ctx context.Context) {
	for _, p := range s.pluginStore.Plugins(ctx) {
		if p.IsCorePlugin() {
			continue
		}
		s.GetInsights(ctx, p.ID, p.Info.Version)
	}
}

// fetch tries the public OpenSSF API first, then the optional sidecar on 404.
func (s *Service) fetch(ctx context.Context, repoPath string) (*pluginscoring.ScorecardResult, error) {
	result, err := s.fetchFromURL(ctx, scorecardAPIBase+"github.com/"+repoPath)
	if err != nil {
		return nil, err
	}
	if result != nil {
		return result, nil
	}

	if s.sidecarURL == "" {
		s.log.Debug("Not in public Scorecard database and no sidecar configured", "repo", repoPath)
		return nil, nil
	}

	s.log.Debug("Not in public Scorecard database, trying sidecar", "repo", repoPath)
	return s.fetchFromURL(ctx, s.sidecarURL+"?repo=github.com/"+repoPath)
}

// fetchFromURL calls a Scorecard-compatible HTTP endpoint. Returns nil on 404.
func (s *Service) fetchFromURL(ctx context.Context, url string) (*pluginscoring.ScorecardResult, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("scorecard API returned HTTP %d for %s", resp.StatusCode, url)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result pluginscoring.ScorecardResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *Service) repoURL(ctx context.Context, pluginID string) string {
	infos, err := s.pluginRepo.GetPluginsInfo(ctx, repo.GetPluginsInfoOptions{
		Plugins: []string{pluginID},
	}, repo.NewCompatOpts("", "", ""))
	if err == nil {
		for _, info := range infos {
			if info.URL != "" {
				return info.URL
			}
		}
	}

	plugin, exists := s.pluginStore.Plugin(ctx, pluginID)
	if !exists {
		return ""
	}
	for _, link := range plugin.Info.Links {
		if strings.Contains(link.URL, "github.com") {
			return link.URL
		}
	}
	return ""
}

func githubRepoPath(rawURL string) string {
	m := githubRepoRe.FindStringSubmatch(strings.TrimSpace(rawURL))
	if len(m) < 2 {
		return ""
	}
	return m[1]
}
