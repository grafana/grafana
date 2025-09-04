package fswebassets

import (
	"path/filepath"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

// New codepath for retrieving web assets URLs for the frontend-service
func GetWebAssets(cfg *setting.Cfg, license licensing.Licensing) (dtos.EntryPointAssets, error) {
	assetsManifest, err := webassets.ReadWebAssetsFromFile(filepath.Join(cfg.StaticRootPath, "build", "assets-manifest.json"))
	if err != nil {
		return dtos.EntryPointAssets{}, err
	}

	// We prefer to set the prefix from config, but make this backwards compatible
	// taking it from the license instead
	var prefix string
	if cfg.CDNRootURL.Path == "" {
		prefix = license.ContentDeliveryPrefix()
	}

	cdnRoot, err := cfg.GetContentDeliveryURL(prefix)
	if err != nil {
		return dtos.EntryPointAssets{}, err
	}

	assetsManifest.SetContentDeliveryURL(cdnRoot)

	return *assetsManifest, nil
}
