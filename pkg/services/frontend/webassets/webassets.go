package fswebassets

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
)

var logger = log.New("webassets")

const remoteCacheTTL = 30 * time.Second

type cachedAssets struct {
	assets    dtos.EntryPointAssets
	fetchedAt time.Time
}

var (
	remoteCache   = map[string]cachedAssets{}
	remoteCacheMu sync.RWMutex
)

// ResetRemoteCache clears the in-memory cache for remote asset manifests.
// Exported for use in tests.
func ResetRemoteCache() {
	remoteCacheMu.Lock()
	remoteCache = map[string]cachedAssets{}
	remoteCacheMu.Unlock()
}

func getCDNRoot(cfg *setting.Cfg, license licensing.Licensing) string {
	if cfg.CDNRootURL == nil {
		return ""
	}

	// We prefer to set the prefix from config, but make this backwards compatible
	// taking it from the license instead
	var prefix string
	if cfg.CDNRootURL.Path == "" {
		prefix = license.ContentDeliveryPrefix()
	}

	cdnRoot, err := cfg.GetContentDeliveryURL(prefix)
	if err != nil {
		logger.Error("error getting cdn url from config", "error", err)
		return ""
	}

	return cdnRoot
}

// GetWebAssets retrieves web asset URLs for the frontend-service.
//
// When assetsBaseOverrideURL is non-empty and the feature is enabled,
// it is used as both the source for the assets manifest and the CDN base URL for all
// asset references. The override URL must match the configured base URL.
// If validation fails, the override is ignored and default assets are returned.
func GetWebAssets(ctx context.Context, cfg *setting.Cfg, license licensing.Licensing, overrideEnabled bool, overrideBaseURL string, assetsBaseOverrideURL string) (dtos.EntryPointAssets, error) {
	if assetsBaseOverrideURL != "" {
		if err := validateOverrideURL(overrideEnabled, overrideBaseURL, assetsBaseOverrideURL); err != nil {
			logger.Warn("ignoring assets base override URL", "url", assetsBaseOverrideURL, "reason", err)
		} else {
			return getRemoteAssets(ctx, assetsBaseOverrideURL)
		}
	}

	return getDefaultAssets(ctx, cfg, license)
}

// validateOverrideURL checks that the assets override feature is enabled and
// the URL starts with the configured base URL. HTTPS is enforced at config
// parse time (see ReadPreviewAssetsConfig).
func validateOverrideURL(enabled bool, baseURL string, overrideURL string) error {
	if !enabled {
		return fmt.Errorf("assets base override is not enabled")
	}

	if baseURL == "" {
		return fmt.Errorf("assets base override base URL is not configured")
	}

	if !strings.HasPrefix(overrideURL, baseURL) {
		return fmt.Errorf("override URL does not match configured base URL")
	}

	return nil
}

func getDefaultAssets(ctx context.Context, cfg *setting.Cfg, license licensing.Licensing) (dtos.EntryPointAssets, error) {
	// Get an OpenFeature client instance for feature flag evaluation
	client := openfeature.NewDefaultClient()

	// Evaluate the feature flag
	useReact19 := client.Boolean(
		ctx,                                 // Request context
		featuremgmt.FlagReact19,             // Feature flag name
		false,                               // Default value if evaluation fails
		openfeature.TransactionContext(ctx), // Extract evaluation context from the request
	)

	var assetsFilename string
	if useReact19 {
		assetsFilename = "assets-manifest-react19.json"
	} else {
		assetsFilename = "assets-manifest.json"
	}
	assetsManifest, err := webassets.ReadWebAssetsFromFile(filepath.Join(cfg.StaticRootPath, "build", assetsFilename))
	if err != nil {
		return dtos.EntryPointAssets{}, err
	}

	cdnRoot := getCDNRoot(cfg, license)
	if cdnRoot != "" {
		assetsManifest.SetContentDeliveryURL(cdnRoot)
	}

	return *assetsManifest, nil
}

// getRemoteAssets fetches the assets manifest from a remote base URL and uses
// that URL as the CDN prefix for all asset paths.
func getRemoteAssets(ctx context.Context, baseURL string) (dtos.EntryPointAssets, error) {
	// Check cache first
	remoteCacheMu.RLock()
	if cached, ok := remoteCache[baseURL]; ok && time.Since(cached.fetchedAt) < remoteCacheTTL {
		remoteCacheMu.RUnlock()
		return cached.assets, nil
	}
	remoteCacheMu.RUnlock()

	// Fetch manifest from the remote URL and use it as the CDN base
	logger.Info("fetching assets manifest from override URL", "url", baseURL)
	result, err := webassets.ReadWebAssetsFromCDN(ctx, baseURL)
	if err != nil {
		return dtos.EntryPointAssets{}, err
	}

	// Cache the result
	remoteCacheMu.Lock()
	remoteCache[baseURL] = cachedAssets{
		assets:    *result,
		fetchedAt: time.Now(),
	}
	remoteCacheMu.Unlock()

	return *result, nil
}
