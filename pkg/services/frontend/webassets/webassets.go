package fswebassets

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

var logger = log.New("webassets")

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

// New codepath for retrieving web assets URLs for the frontend-service
func GetWebAssets(ctx context.Context, cfg *setting.Cfg, license licensing.Licensing, buildDir string) (dtos.EntryPointAssets, error) {
	assetsManifest, err := webassets.ReadWebAssetsFromFile(filepath.Join(cfg.StaticRootPath, buildDir, webassets.AssetsManifestFile))
	if err != nil {
		return dtos.EntryPointAssets{}, err
	}

	assetsManifest.PublicPath = webassets.PublicPathFor(buildDir)

	cdnRoot := getCDNRoot(cfg, license)
	if cdnRoot != "" {
		assetsManifest.SetContentDeliveryURL(cdnRoot)
	}

	return *assetsManifest, nil
}
