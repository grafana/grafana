package fswebassets

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/setting"
)

// validPreviewAssetsFolder matches deploy IDs created by the deploy-frontend-preview
// CI workflow, e.g. pr_grafana_123456. Deliberately strict so a folder name can
// never introduce new path segments or URL metacharacters.
var validPreviewAssetsFolder = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

const (
	maxPreviewAssetsFolderLength = 128

	// previewCacheTTL keeps remote manifest fetches off the hot path while still
	// picking up re-deploys of the same preview folder quickly. Failed lookups
	// are cached for the same period: the preview cookie lives for 24 hours and
	// its folder can vanish from the bucket, so without negative caching every
	// page load would pay a blocking remote roundtrip just to fall back to the
	// default assets.
	previewCacheTTL = 30 * time.Second

	// previewFetchTimeout bounds the manifest fetch: the shared HTTP client
	// (webassets.ReadWebAssetsFromCDN) sets no timeout of its own, and the
	// fetch runs detached from the caller's context (see GetPreviewWebAssets).
	previewFetchTimeout = 10 * time.Second
)

// PreviewAssetsConfig configures serving frontend assets from a preview build
// uploaded by CI instead of the release assets. This is a development-only
// feature: it must never be enabled in production because it serves
// non-released JavaScript to the browser.
type PreviewAssetsConfig struct {
	// Enabled turns the preview assets feature on. When false (the default)
	// the preview routes are not registered and cookies are ignored.
	Enabled bool

	// BaseURL is the only origin preview assets can be loaded from. A per-user
	// folder name is appended to it server-side, so requests can never point
	// the service at an arbitrary origin.
	BaseURL string
}

// Active returns true only when the feature is both enabled and has a base URL
// to resolve preview folders against.
func (c PreviewAssetsConfig) Active() bool {
	return c.Enabled && c.BaseURL != ""
}

// ReadPreviewAssetsConfig reads the preview assets configuration. It is
// startup-time, cluster-wide configuration and deliberately cannot be
// overridden per tenant via the settings service.
func ReadPreviewAssetsConfig(cfg *setting.Cfg) PreviewAssetsConfig {
	sec := cfg.SectionWithEnvOverrides("frontend_service")
	return PreviewAssetsConfig{
		Enabled: sec.Key("preview_assets_enabled").MustBool(false),
		BaseURL: sec.Key("preview_assets_base_url").String(),
	}
}

// ResolvePreviewAssetsURL builds the full assets URL for a preview folder,
// validating the folder name so the result always stays under the configured
// base URL.
func ResolvePreviewAssetsURL(baseURL string, folder string) (string, error) {
	if baseURL == "" {
		return "", fmt.Errorf("preview assets base URL is not configured")
	}

	if folder == "" {
		return "", fmt.Errorf("preview assets folder is empty")
	}

	if len(folder) > maxPreviewAssetsFolderLength {
		return "", fmt.Errorf("preview assets folder exceeds maximum length")
	}

	if !validPreviewAssetsFolder.MatchString(folder) {
		return "", fmt.Errorf("preview assets folder contains invalid characters")
	}

	base := baseURL
	if !strings.HasSuffix(base, "/") {
		base += "/"
	}
	return base + folder + "/", nil
}

type cachedPreviewAssets struct {
	assets    dtos.EntryPointAssets
	err       error
	fetchedAt time.Time
}

var (
	previewCacheMu sync.Mutex
	previewCache   = map[string]cachedPreviewAssets{}

	// previewFlights collapses concurrent fetches of the same assets URL into
	// one remote request, so a slow bucket response costs a single connection
	// and concurrent misses cannot race each other's cache writes.
	previewFlights singleflight.Group
)

// ResetPreviewAssetsCache clears the preview manifest cache. Exported for tests.
func ResetPreviewAssetsCache() {
	previewCacheMu.Lock()
	previewCache = map[string]cachedPreviewAssets{}
	previewCacheMu.Unlock()
}

// GetPreviewWebAssets fetches the assets manifest for a preview folder and
// returns entrypoints with all asset URLs rooted at the preview location.
// Results, including fetch failures, are cached for previewCacheTTL, and
// concurrent callers for the same URL share a single remote fetch.
func GetPreviewWebAssets(ctx context.Context, preview PreviewAssetsConfig, folder string) (dtos.EntryPointAssets, error) {
	if !preview.Active() {
		return dtos.EntryPointAssets{}, fmt.Errorf("preview assets are not enabled")
	}

	assetsURL, err := ResolvePreviewAssetsURL(preview.BaseURL, folder)
	if err != nil {
		return dtos.EntryPointAssets{}, err
	}

	if cached, ok := getCachedPreviewAssets(assetsURL); ok {
		return cached.assets, cached.err
	}

	ch := previewFlights.DoChan(assetsURL, func() (any, error) {
		// Re-check under the flight: a previous flight may have populated the
		// cache while we waited for the singleflight slot.
		if cached, ok := getCachedPreviewAssets(assetsURL); ok {
			return cached, nil
		}

		logger.Info("fetching preview assets manifest", "url", assetsURL)
		// Detach from the caller's context so one caller disconnecting doesn't
		// cache a context error for every request in the next TTL window; the
		// explicit timeout bounds the fetch because the shared HTTP client
		// doesn't.
		fetchCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), previewFetchTimeout)
		defer cancel()

		result, err := webassets.ReadWebAssetsFromCDN(fetchCtx, "build", assetsURL)

		entry := cachedPreviewAssets{err: err, fetchedAt: time.Now()}
		if err == nil {
			entry.assets = *result
		}

		previewCacheMu.Lock()
		previewCache[assetsURL] = entry
		previewCacheMu.Unlock()

		return entry, nil
	})

	// Wait on this caller's own context so a cancelled request returns promptly
	// while the shared fetch continues for the other waiters.
	select {
	case <-ctx.Done():
		return dtos.EntryPointAssets{}, ctx.Err()
	case flight := <-ch:
		if flight.Err != nil {
			return dtos.EntryPointAssets{}, flight.Err
		}
		entry := flight.Val.(cachedPreviewAssets)
		return entry.assets, entry.err
	}
}

// getCachedPreviewAssets returns the live cache entry for assetsURL, evicting
// expired entries first.
func getCachedPreviewAssets(assetsURL string) (cachedPreviewAssets, bool) {
	previewCacheMu.Lock()
	defer previewCacheMu.Unlock()

	for key, cached := range previewCache {
		if time.Since(cached.fetchedAt) >= previewCacheTTL {
			delete(previewCache, key)
		}
	}

	cached, ok := previewCache[assetsURL]
	return cached, ok
}
