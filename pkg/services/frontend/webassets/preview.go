package fswebassets

import (
	"context"
	"fmt"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// Deploy IDs like pr_grafana_123456. Deliberately strict so a folder can never
// introduce path segments or URL metacharacters.
var validPreviewAssetsFolder = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

const (
	maxPreviewAssetsFolderLength = 128
	previewCacheTTL              = 30 * time.Second
	previewFetchTimeout          = 10 * time.Second
)

// PreviewAssetsConfig configures serving frontend assets from a CI-uploaded
// preview build instead of the release assets.
// Should NEVER be enabled in production.
type PreviewAssetsConfig struct {
	BaseURL string

	// Only these namespaces serve preview assets; empty disables the feature.
	AllowedNamespaces []string
}

// Configured reports whether the cluster serves preview assets at all.
// Per-request access also requires an opted-in namespace: see Active.
func (c PreviewAssetsConfig) Configured() bool {
	return c.BaseURL != "" && len(c.AllowedNamespaces) > 0
}

// Active reports whether preview assets are available to the request's
// namespace. Fails closed: requests without a namespace never see previews.
func (c PreviewAssetsConfig) Active(namespace string) bool {
	return c.Configured() && namespace != "" && slices.Contains(c.AllowedNamespaces, namespace)
}

// ReadPreviewAssetsConfig reads startup-time, cluster-wide configuration;
// deliberately not overridable per tenant via the settings service.
func ReadPreviewAssetsConfig(cfg *setting.Cfg) PreviewAssetsConfig {
	sec := cfg.SectionWithEnvOverrides("frontend_service")
	return PreviewAssetsConfig{
		BaseURL:           sec.Key("preview_assets_base_url").String(),
		AllowedNamespaces: util.SplitString(sec.Key("preview_assets_allowed_namespaces").String()),
	}
}

// ResolvePreviewAssetsURL validates the folder name and roots the URL under baseURL.
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

	// Collapses concurrent fetches of the same assets URL into one remote request.
	previewFlights singleflight.Group
)

// Clears the cache, exported just for tests.
func ResetPreviewAssetsCache() {
	previewCacheMu.Lock()
	previewCache = map[string]cachedPreviewAssets{}
	previewCacheMu.Unlock()
}

// GetPreviewWebAssets fetches the assets manifest for a preview folder, with all
// asset URLs rooted at the preview location.
func GetPreviewWebAssets(ctx context.Context, preview PreviewAssetsConfig, folder string) (dtos.EntryPointAssets, error) {
	if !preview.Configured() {
		return dtos.EntryPointAssets{}, fmt.Errorf("preview assets are not configured")
	}

	assetsURL, err := ResolvePreviewAssetsURL(preview.BaseURL, folder)
	if err != nil {
		return dtos.EntryPointAssets{}, err
	}

	if cached, ok := getCachedPreviewAssets(assetsURL); ok {
		return cached.assets, cached.err
	}

	ch := previewFlights.DoChan(assetsURL, func() (any, error) {
		// A previous flight may have filled the cache while we waited for the slot.
		if cached, ok := getCachedPreviewAssets(assetsURL); ok {
			return cached, nil
		}

		logger.Info("fetching preview assets manifest", "url", assetsURL)
		// Detached so one caller disconnecting doesn't cache a context error for
		// every request in the next TTL window.
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

	// A cancelled request returns promptly; the shared fetch continues for others.
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

// getCachedPreviewAssets returns the live entry, evicting expired entries first.
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
