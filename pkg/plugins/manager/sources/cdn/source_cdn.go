package cdn

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/pluginerrs"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

const concurrencyLimit = 32

var pluginFetchDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Namespace: "grafana",
	Subsystem: "plugins",
	Name:      "fetch_duration_seconds",
	Help:      "The duration for a plugin fetch request",
}, []string{"class", "count"})

type pluginKey struct {
	path    string
	id      string
	version string
}

// Source discovers plugins that are served from a remote URL rather than from disk.
//
// Plugins are configured per plugin, in one of two ways:
//   - [plugin.<id>] cdn_url = <url>: the plugin is served from the URL (declarative). Nested plugins listed in the
//     plugin's "includes" are discovered relative to that URL, so only the parent needs to be configured.
//   - [plugins] cdn_base_url plus [plugin.<id>] cdn = true and cdn_version: the URL is built from a template.
type Source struct {
	cdnService *pluginscdn.Service
	cfg        *config.PluginManagementCfg
	log        log.Logger
	client     *http.Client

	errorTracker pluginerrs.ErrorTracker
	backoffCfg   backoff.Config
}

func NewCDNSource(cfg *config.PluginManagementCfg, cdnService *pluginscdn.Service, errorTracker pluginerrs.ErrorTracker) *Source {
	return &Source{
		cdnService:   cdnService,
		cfg:          cfg,
		log:          log.New("cdn.source"),
		client:       http.DefaultClient,
		errorTracker: errorTracker,
		backoffCfg: backoff.Config{
			MinBackoff: 100 * time.Millisecond,
			MaxBackoff: 500 * time.Millisecond,
			MaxRetries: 3,
		},
	}
}

func (s *Source) PluginClass(_ context.Context) plugins.Class {
	return plugins.ClassExternal
}

func (s *Source) DefaultSignature(_ context.Context, pluginID string) (plugins.Signature, bool) {
	v, ok := s.cfg.PluginSettings[pluginID]["signature_type"]
	if !ok {
		// Unsupported config (missing key), fall back to old behaviour
		return plugins.Signature{Status: plugins.SignatureStatusValid}, true
	}
	cfgSigType := plugins.SignatureType(v)
	if !cfgSigType.IsValid() {
		s.log.Warn("CDN plugin has invalid signature type", "id", pluginID, "signatureType", cfgSigType)
		return plugins.Signature{
			Status: plugins.SignatureStatusUnsigned,
		}, true
	}
	cfgSigOrg := s.cfg.PluginSettings[pluginID]["signature_org_name"]
	return plugins.Signature{
		Status:     plugins.SignatureStatusValid,
		Type:       cfgSigType,
		SigningOrg: cfgSigOrg,
	}, true
}

func (s *Source) Discover(ctx context.Context) ([]*plugins.FoundBundle, error) {
	urls := s.getValidURLs(ctx, s.pluginCDNURLs(ctx))
	if len(urls) == 0 {
		return []*plugins.FoundBundle{}, nil
	}

	startTime := time.Now()
	type jsonData struct {
		u cdnPluginURL

		jd  plugins.JSONData
		err error
	}
	results := make(chan jsonData, len(urls))

	limitSize := min(len(urls), concurrencyLimit)
	limit := make(chan struct{}, limitSize)

	for _, u := range urls {
		limit <- struct{}{}
		go func() {
			jd, err := s.fetchPlugin(ctx, u.url)
			results <- jsonData{
				u:   u,
				jd:  jd,
				err: err,
			}
			<-limit
		}()
	}

	foundPlugins := make(map[pluginKey]plugins.JSONData)
	for range urls {
		r := <-results
		if r.err != nil {
			s.log.Error("Could not fetch plugin", "path", r.u.url.String(), "error", r.err)
			s.recordError(ctx, r.u.pluginID, r.err)
			continue
		}
		foundPlugins[pluginKey{
			id:      r.jd.ID,
			version: r.jd.Info.Version,
			path:    r.u.url.String(),
		}] = r.jd
	}

	if len(foundPlugins) == 0 {
		return []*plugins.FoundBundle{}, nil
	}

	res := s.collectBundles(ctx, foundPlugins)

	sort.SliceStable(res, func(i, j int) bool {
		return res[i].Primary.JSONData.ID < res[j].Primary.JSONData.ID
	})

	pluginFetchDuration.WithLabelValues("cdn", strconv.Itoa(len(res))).Observe(time.Since(startTime).Seconds())
	s.log.Debug("Plugin find complete", "class", "cdn", "total", len(res), "duration", time.Since(startTime))
	return res, nil
}

func (s *Source) fetchPlugin(ctx context.Context, base *url.URL) (plugins.JSONData, error) {
	u := base.JoinPath("plugin.json")
	// It's safe to ignore gosec warning G107 since the path comes from the Grafana configuration and is also
	// suffixed above with "plugin.json"
	// nolint:gosec
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return plugins.JSONData{}, err
	}

	var lastErr error
	backoffState := backoff.New(ctx, s.backoffCfg)
	for backoffState.Ongoing() {
		plugin, retry, err := s.fetchPluginAttempt(req, base)
		if !retry {
			return plugin, err
		}
		lastErr = err
		backoffState.Wait()
	}

	if lastErr == nil {
		lastErr = backoffState.Err()
	}
	return plugins.JSONData{}, lastErr
}

// fetchPluginAttempt fetches plugin.json once, reporting whether a failure is
// worth retrying.
func (s *Source) fetchPluginAttempt(req *http.Request, base *url.URL) (plugins.JSONData, bool, error) {
	resp, err := s.client.Do(req)
	if err != nil {
		s.log.Warn("Error occurred when fetching plugin.json", "url", base, "error", err)
		return plugins.JSONData{}, isRetryableError(err), err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			s.log.Warn("Error occurred when closing response body", "url", base, "error", err)
		}
	}()

	if isRetryableStatus(resp.StatusCode) {
		s.log.Warn("Could not retrieve plugin.json", "url", base, "statusCode", resp.StatusCode)
		return plugins.JSONData{}, true, fmt.Errorf("could not retrieve plugin.json")
	}

	if resp.StatusCode == http.StatusNotFound {
		return plugins.JSONData{}, false, fmt.Errorf("plugin.json not found")
	}

	if resp.StatusCode/100 != 2 {
		return plugins.JSONData{}, false, fmt.Errorf("could not retrieve plugin.json")
	}

	plugin, err := plugins.ReadPluginJSON(resp.Body)
	if err != nil {
		s.log.Warn("Error occurred when reading plugin.json", "url", base, "error", err)
		return plugins.JSONData{}, false, err
	}

	return plugin, false, nil
}

// isRetryableStatus reports whether an HTTP status warrants a retry: the CDN is
// rate limiting (429) or hit a server-side error (5xx).
func isRetryableStatus(code int) bool {
	return code == http.StatusTooManyRequests || code >= http.StatusInternalServerError
}

// isRetryableError reports whether a transport error warrants a retry. A failed
// certificate verification won't resolve itself between attempts.
func isRetryableError(err error) bool {
	var certErr *tls.CertificateVerificationError
	return !errors.As(err, &certErr)
}

func (s *Source) getValidURLs(ctx context.Context, urls []cdnPluginPath) []cdnPluginURL {
	if len(urls) == 0 {
		return []cdnPluginURL{}
	}

	m := make(map[string]cdnPluginURL)
	for _, u := range urls {
		if !strings.HasPrefix(u.path, "http") {
			s.log.Warn("Skipping finding plugins as path is invalid URL", "url", u.path)
			s.recordError(ctx, u.pluginID, fmt.Errorf("invalid plugin URL %q", u.path))
			continue
		}

		pu, err := url.Parse(u.path)
		if err != nil {
			s.log.Warn("Skipping finding plugins as path is invalid URL", "url", u.path)
			s.recordError(ctx, u.pluginID, err)
			continue
		}

		m[u.path] = cdnPluginURL{pluginID: u.pluginID, url: pu}
	}

	res := make([]cdnPluginURL, 0, len(m))
	for _, u := range m {
		res = append(res, u)
	}

	return res
}

// recordError records a configured plugin that could not be discovered, so it
// is reported as failed to load rather than treated as not installed.
func (s *Source) recordError(ctx context.Context, pluginID string, err error) {
	s.errorTracker.Record(ctx, &plugins.Error{
		PluginID:  pluginID,
		ErrorCode: plugins.ErrorCode(err.Error()),
	})
}

// collectBundles groups the discovered plugins into bundles, one per top-level plugin.
//
// A plugin is a child of another when its URL is below the other's URL, which is how plugins that have their own
// cdn_url are nested. Nested plugins listed in a plugin's "includes" are otherwise fetched relative to the
// parent's URL, so only the parent needs to be configured. A nested plugin that is configured explicitly always
// wins over the URL derived from its parent, even when its own URL cannot be fetched.
func (s *Source) collectBundles(ctx context.Context, foundPlugins map[pluginKey]plugins.JSONData) []*plugins.FoundBundle {
	res := s.groupByPath(foundPlugins)

	known := make(map[string]struct{}, len(foundPlugins))
	configured := make(map[string]struct{}, len(foundPlugins))
	for key, jd := range foundPlugins {
		known[trimSlash(key.path)] = struct{}{}
		configured[jd.ID] = struct{}{}
	}
	// A configured plugin that could not be fetched is still configured, and must not be replaced by the URL
	// derived from its parent
	for pluginID, cfg := range s.cfg.PluginSettings {
		if cfg["cdn_url"] != "" || (s.cdnService.PluginSupported(pluginID) && cfg["cdn_version"] != "") {
			configured[pluginID] = struct{}{}
		}
	}
	return s.attachIncludes(ctx, res, known, configured)
}

// groupByPath uses the path hierarchy of the discovered plugins to determine parent-child relationships.
func (s *Source) groupByPath(foundPlugins map[pluginKey]plugins.JSONData) []*plugins.FoundBundle {
	var res []*plugins.FoundBundle
	for plugin, pluginJSON := range foundPlugins {
		isChild := false
		var children []*plugins.FoundPlugin
		for check, checkJSON := range foundPlugins {
			if trimSlash(check.path) == trimSlash(plugin.path) {
				continue
			}

			if isBelow(plugin.path, check.path) {
				isChild = true
				break
			} else if isBelow(check.path, plugin.path) {
				children = append(children, &plugins.FoundPlugin{
					JSONData: checkJSON,
					FS:       NewFS(check.path, s.client),
				})
			}
		}

		if !isChild {
			res = append(res, &plugins.FoundBundle{
				Primary: plugins.FoundPlugin{
					JSONData: pluginJSON,
					FS:       NewFS(plugin.path, s.client),
				},
				Children: children,
			})
		}
	}

	return res
}

// attachIncludes fetches the nested panel and datasource plugins that each bundle's primary plugin lists in its
// "includes", relative to the primary plugin's URL, and adds them as children. known holds the URLs that have
// already been discovered, and configured the IDs of the plugins that were configured explicitly, so that a plugin
// is never added twice. The returned bundles no longer contain configured plugins that became a child.
func (s *Source) attachIncludes(ctx context.Context, bundles []*plugins.FoundBundle, known map[string]struct{}, configured map[string]struct{}) []*plugins.FoundBundle {
	type job struct {
		bundle *plugins.FoundBundle
		name   string
		path   string
		base   *url.URL
	}

	var jobs []job
	for _, bundle := range bundles {
		parentBase, err := url.Parse(bundle.Primary.FS.Base())
		if err != nil {
			s.log.Error("Could not parse plugin URL", "pluginId", bundle.Primary.JSONData.ID, "error", err)
			continue
		}

		for _, include := range bundle.Primary.JSONData.Includes {
			if !slices.Contains([]string{"panel", "datasource"}, include.Type) || include.Path == "" {
				continue
			}

			base := parentBase.JoinPath(path.Dir(include.Path))
			if _, ok := known[trimSlash(base.String())]; ok {
				continue
			}
			known[trimSlash(base.String())] = struct{}{}
			jobs = append(jobs, job{bundle: bundle, name: include.Name, path: include.Path, base: base})
		}
	}
	if len(jobs) == 0 {
		return bundles
	}

	results := make([]*plugins.FoundPlugin, len(jobs))
	limit := make(chan struct{}, min(len(jobs), concurrencyLimit))
	var wg sync.WaitGroup
	for i, j := range jobs {
		limit <- struct{}{}
		wg.Add(1)
		go func() {
			defer func() {
				<-limit
				wg.Done()
			}()

			jd, err := s.fetchPlugin(ctx, j.base)
			if err != nil {
				s.log.Error("Could not fetch nested plugin", "name", j.name, "path", j.path, "error", err)
				return
			}
			results[i] = &plugins.FoundPlugin{JSONData: jd, FS: NewFS(j.base.String(), s.client)}
		}()
	}
	wg.Wait()

	// Attach in include order, so the result does not depend on fetch timing
	for i, r := range results {
		if r == nil {
			continue
		}
		if _, ok := configured[r.JSONData.ID]; ok {
			// The URL derived from the parent is ignored, the explicitly configured plugin is used instead
			bundles = adopt(bundles, jobs[i].bundle, r.JSONData.ID)
			continue
		}
		jobs[i].bundle.Children = append(jobs[i].bundle.Children, r)
	}
	return bundles
}

// adopt makes the top-level plugin with the given ID, along with its children, a child of parent. It does nothing
// if the plugin is already nested.
func adopt(bundles []*plugins.FoundBundle, parent *plugins.FoundBundle, id string) []*plugins.FoundBundle {
	for i, b := range bundles {
		if b == parent || b.Primary.JSONData.ID != id {
			continue
		}
		parent.Children = append(parent.Children, &b.Primary)
		parent.Children = append(parent.Children, b.Children...)
		return append(bundles[:i], bundles[i+1:]...)
	}
	return bundles
}

// trimSlash normalizes a plugin URL for comparison.
func trimSlash(u string) string {
	return strings.TrimRight(u, "/")
}

// isBelow reports whether the URL child is nested below the URL parent. Whole path segments are compared, so
// "https://host/foobar" is not below "https://host/foo".
func isBelow(child, parent string) bool {
	return strings.HasPrefix(trimSlash(child)+"/", trimSlash(parent)+"/") && trimSlash(child) != trimSlash(parent)
}

// cdnPluginPath is a configured plugin's CDN path. The plugin ID comes from the
// config, so a failure can be recorded even when plugin.json is never read.
type cdnPluginPath struct {
	pluginID string
	path     string
}

type cdnPluginURL struct {
	pluginID string
	url      *url.URL
}

// pluginCDNURLs provides a list of URLs for plugins that are marked as CDN enabled via the config
func (s *Source) pluginCDNURLs(ctx context.Context) []cdnPluginPath {
	var cdnEnabledPaths []cdnPluginPath
	for pluginID, cfg := range s.cfg.PluginSettings {
		if cfg["cdn_url"] != "" {
			cdnEnabledPaths = append(cdnEnabledPaths, cdnPluginPath{pluginID: pluginID, path: cfg["cdn_url"]})
		} else if s.cdnService.PluginSupported(pluginID) && cfg["cdn_version"] != "" {
			base, err := s.cdnService.AssetURL(pluginID, cfg["cdn_version"], "")
			if err != nil {
				s.log.Warn("Skipping sourcing plugin as an error occurred", "pluginId", pluginID, "error", err)
				s.recordError(ctx, pluginID, err)
				continue
			}
			cdnEnabledPaths = append(cdnEnabledPaths, cdnPluginPath{pluginID: pluginID, path: base})
		}
	}
	paths := make([]string, 0, len(cdnEnabledPaths))
	for _, p := range cdnEnabledPaths {
		paths = append(paths, p.path)
	}
	s.log.Debug("Found plugin CDN URLs", "paths", paths)
	return cdnEnabledPaths
}
