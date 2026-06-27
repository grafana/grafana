package pluginscorecard

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
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
	sidecarTimeout   = 5 * time.Minute
	scorecardAPIBase = "https://api.securityscorecards.dev/projects/"
	// maxConcurrentScans limits simultaneous sidecar scans per sidecar type.
	// Each sidecar is single-threaded (CGI) — without a limit concurrent
	// requests queue up and time out.
	maxConcurrentScans = 5
)

var githubRepoRe = regexp.MustCompile(`^https://github\.com/([^/]+/[^/]+?)(?:\.git)?/?$`)

// cachedResult stores raw results from all scanners so merge weights can
// evolve without requiring a re-scan.
type cachedResult struct {
	Scorecard *pluginscoring.ScorecardResult   `json:"scorecard,omitempty"`
	ESLint    []pluginscoring.ESLintFileResult `json:"eslint,omitempty"`
	Gosec     *pluginscoring.GosecResult       `json:"gosec,omitempty"`
	ScoredAt  time.Time                        `json:"scored_at"`
}

// Service fetches and caches scanner results, returning merged
// pluginscoring.CatalogPluginInsights — the stable Grafana-owned scoring schema.
type Service struct {
	pluginStore     pluginstore.Store
	pluginRepo      repo.Service
	kvStore         *kvstore.NamespacedKVStore
	sidecarURL      string
	eslintURL       string
	gosecURL        string
	httpClient      *http.Client
	scanSemaphore   chan struct{}
	eslintSemaphore chan struct{}
	gosecSemaphore  chan struct{}
	log             log.Logger
}

func ProvideService(
	cfg *setting.Cfg,
	pluginStore pluginstore.Store,
	pluginRepo repo.Service,
	kvStore kvstore.KVStore,
) *Service {
	svc := &Service{
		pluginStore:     pluginStore,
		pluginRepo:      pluginRepo,
		kvStore:         kvstore.WithNamespace(kvStore, 0, kvNamespace),
		sidecarURL:      cfg.PluginScorecardSidecarURL,
		eslintURL:       cfg.PluginESLintSidecarURL,
		gosecURL:        cfg.PluginGosecSidecarURL,
		httpClient:      &http.Client{Timeout: httpTimeout},
		scanSemaphore:   make(chan struct{}, maxConcurrentScans),
		eslintSemaphore: make(chan struct{}, maxConcurrentScans),
		gosecSemaphore:  make(chan struct{}, maxConcurrentScans),
		log:             log.New("plugins.scorecard"),
	}
	go func() { _ = svc.Run(context.Background()) }()
	return svc
}

// GetInsights returns scored Insights for a plugin, using kvstore cache when fresh.
// The returned CatalogPluginInsights always includes a KRM-style conditions array:
//   - Ready=True, reason=ScorecardScanned     — result available
//   - Ready=False, reason=ScorecardScanning   — scan triggered, client should retry
//   - Ready=False, reason=ScorecardUnavailable — no repo URL, permanently unavailable
func (s *Service) GetInsights(ctx context.Context, pluginID, version string) (*pluginscoring.CatalogPluginInsights, bool) {
	cacheKey := pluginID + "@" + version

	if raw, ok, err := s.kvStore.Get(ctx, cacheKey); err == nil && ok {
		var cached cachedResult
		if json.Unmarshal([]byte(raw), &cached) == nil && !cached.ScoredAt.IsZero() {
			// Unavailable marker — no scorecard checks and no ESLint. Re-try after 1 hour.
			if cached.Scorecard == nil && len(cached.ESLint) == 0 && time.Since(cached.ScoredAt) < time.Hour {
				unavailable := pluginscoring.UnavailableInsights(pluginID, version)
				return &unavailable, true
			}
			// Real result within TTL.
			if cached.Scorecard != nil && len(cached.Scorecard.Checks) > 0 && time.Since(cached.ScoredAt) < cacheTTL {
				insights := pluginscoring.Merge(pluginID, version, cached.Scorecard, cached.ESLint, cached.Gosec)
				return &insights, true
			}
		}
	}

	repoURL := s.repoURL(ctx, pluginID)
	if repoURL == "" {
		unavailable := pluginscoring.UnavailableInsights(pluginID, version)
		return &unavailable, true
	}

	repoPath := githubRepoPath(repoURL)
	if repoPath == "" {
		unavailable := pluginscoring.UnavailableInsights(pluginID, version)
		return &unavailable, true
	}

	// Trigger both sidecars asynchronously and concurrently.
	// Each sidecar has its own semaphore to prevent overwhelming single-threaded CGI processes.
	// Results are merged and written to kvstore as a single cachedResult.
	go func() {
		bgCtx := context.Background()
		var wg sync.WaitGroup
		var scResult *pluginscoring.ScorecardResult
		var elResult []pluginscoring.ESLintFileResult
		var goResult *pluginscoring.GosecResult

		wg.Add(1)
		go func() {
			defer wg.Done()
			s.scanSemaphore <- struct{}{}
			defer func() { <-s.scanSemaphore }()
			r, err := s.fetch(bgCtx, repoPath)
			if err != nil {
				s.log.Warn("Failed to fetch scorecard", "plugin", pluginID, "repo", repoPath, "error", err)
			}
			scResult = r
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()
			s.eslintSemaphore <- struct{}{}
			defer func() { <-s.eslintSemaphore }()
			r, err := s.fetchESLint(bgCtx, repoPath)
			if err != nil {
				s.log.Warn("Failed to fetch ESLint results", "plugin", pluginID, "repo", repoPath, "error", err)
			}
			elResult = r
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()
			s.gosecSemaphore <- struct{}{}
			defer func() { <-s.gosecSemaphore }()
			r, err := s.fetchGosec(bgCtx, repoPath)
			if err != nil {
				s.log.Warn("Failed to fetch gosec results", "plugin", pluginID, "repo", repoPath, "error", err)
			}
			goResult = r
		}()

		wg.Wait()

		if scResult == nil && len(elResult) == 0 && goResult == nil {
			// Write unavailable marker so we don't re-scan on every request.
			marker := cachedResult{ScoredAt: time.Now().UTC()}
			if raw, err := json.Marshal(marker); err == nil {
				_ = s.kvStore.Set(bgCtx, cacheKey, string(raw))
			}
			return
		}

		cached := cachedResult{
			Scorecard: scResult,
			ESLint:    elResult,
			Gosec:     goResult,
			ScoredAt:  time.Now().UTC(),
		}
		if raw, err := json.Marshal(cached); err == nil {
			if err := s.kvStore.Set(bgCtx, cacheKey, string(raw)); err != nil {
				s.log.Warn("Failed to cache scan results", "plugin", pluginID, "error", err)
			}
		}
	}()

	pending := pluginscoring.PendingInsights(pluginID, version)
	return &pending, true
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
		pluginID := p.ID
		version := p.Info.Version
		go func() {
			s.GetInsights(ctx, pluginID, version)
		}()
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
	// Dedicated client — the main httpClient has a 30s timeout causing EOF on long scans.
	sidecarClient := &http.Client{Timeout: sidecarTimeout}
	sidecarReq, sidecarErr := http.NewRequestWithContext(context.Background(), http.MethodGet,
		s.sidecarURL+"?repo=github.com/"+repoPath, nil)
	if sidecarErr != nil {
		return nil, sidecarErr
	}
	sidecarReq.Header.Set("Accept", "application/json")
	sidecarResp, sidecarErr := sidecarClient.Do(sidecarReq)
	if sidecarErr != nil {
		return nil, sidecarErr
	}
	defer func() { _ = sidecarResp.Body.Close() }()
	if sidecarResp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if sidecarResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sidecar returned HTTP %d", sidecarResp.StatusCode)
	}
	sidecarBody, sidecarErr := io.ReadAll(sidecarResp.Body)
	if sidecarErr != nil {
		return nil, sidecarErr
	}
	var sidecarResult pluginscoring.ScorecardResult
	if err := json.Unmarshal(sidecarBody, &sidecarResult); err != nil {
		return nil, err
	}
	return &sidecarResult, nil
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

// fetchESLint calls the ESLint sidecar and parses its JSON output.
// Returns nil when the sidecar is not configured, repo has no JS/TS files, or repo not found.
func (s *Service) fetchESLint(ctx context.Context, repoPath string) ([]pluginscoring.ESLintFileResult, error) {
	if s.eslintURL == "" {
		return nil, nil
	}

	eslintClient := &http.Client{Timeout: sidecarTimeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		s.eslintURL+"?repo=github.com/"+repoPath, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := eslintClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("eslint sidecar returned HTTP %d for %s", resp.StatusCode, repoPath)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Sidecar returns {"results":[],"message":"..."} when no JS/TS files found.
	if len(body) > 0 && body[0] == '{' {
		return nil, nil
	}

	var files []pluginscoring.ESLintFileResult
	if err := json.Unmarshal(body, &files); err != nil {
		return nil, err
	}
	return files, nil
}

// fetchGosec calls the gosec SAST sidecar and parses its JSON output.
// Returns nil when the sidecar is not configured, repo has no Go files, or repo not found.
func (s *Service) fetchGosec(ctx context.Context, repoPath string) (*pluginscoring.GosecResult, error) {
	if s.gosecURL == "" {
		return nil, nil
	}

	gosecClient := &http.Client{Timeout: sidecarTimeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		s.gosecURL+"?repo=github.com/"+repoPath, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := gosecClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gosec sidecar returned HTTP %d for %s", resp.StatusCode, repoPath)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result pluginscoring.GosecResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	// Sidecar returns {"Issues":[],...,"message":"no Go source files found"} for non-Go repos.
	if len(result.Issues) == 0 {
		return nil, nil
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
