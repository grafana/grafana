package fswebassets

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

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
	// picking up re-deploys of the same preview folder quickly.
	previewCacheTTL = 30 * time.Second
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
	fetchedAt time.Time
}

var (
	previewCacheMu sync.Mutex
	previewCache   = map[string]cachedPreviewAssets{}
)

// ResetPreviewAssetsCache clears the preview manifest cache. Exported for tests.
func ResetPreviewAssetsCache() {
	previewCacheMu.Lock()
	previewCache = map[string]cachedPreviewAssets{}
	previewCacheMu.Unlock()
}

// GetPreviewWebAssets fetches the assets manifest for a preview folder and
// returns entrypoints with all asset URLs rooted at the preview location.
func GetPreviewWebAssets(ctx context.Context, preview PreviewAssetsConfig, folder string) (dtos.EntryPointAssets, error) {
	if !preview.Active() {
		return dtos.EntryPointAssets{}, fmt.Errorf("preview assets are not enabled")
	}

	assetsURL, err := ResolvePreviewAssetsURL(preview.BaseURL, folder)
	if err != nil {
		return dtos.EntryPointAssets{}, err
	}

	previewCacheMu.Lock()
	defer previewCacheMu.Unlock()

	for key, cached := range previewCache {
		if time.Since(cached.fetchedAt) >= previewCacheTTL {
			delete(previewCache, key)
		}
	}

	if cached, ok := previewCache[assetsURL]; ok {
		return cached.assets, nil
	}

	logger.Info("fetching preview assets manifest", "url", assetsURL)
	result, err := webassets.ReadWebAssetsFromCDN(ctx, "build", assetsURL)
	if err != nil {
		return dtos.EntryPointAssets{}, err
	}

	previewCache[assetsURL] = cachedPreviewAssets{
		assets:    *result,
		fetchedAt: time.Now(),
	}

	return *result, nil
}
