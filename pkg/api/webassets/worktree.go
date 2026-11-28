package webassets

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

// FrontendHeader names the local development frontend a request should be rendered with. A
// trusted dev proxy sets it; see [setting.Cfg.FrontendDevWorktreeServerURLTemplate].
const FrontendHeader = "X-Grafana-Frontend"

// frontendName is a single DNS label, so the substituted host can never leave the template's
// `<label>.localhost` shape.
var frontendName = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)

// GetWebAssetsForRequest returns the assets for the frontend selected by the request's
// FrontendHeader, or the default assets when none is selected or it cannot be reached.
func GetWebAssetsForRequest(ctx context.Context, req *http.Request, cfg *setting.Cfg, license licensing.Licensing) (*dtos.EntryPointAssets, error) {
	if assets := WorktreeAssets(ctx, req, cfg); assets != nil {
		return assets, nil
	}
	return GetWebAssets(ctx, BuildDir, cfg, license)
}

// WorktreeAssets reads the manifest of the frontend dev server the request selects. It returns
// nil, leaving the caller to use its default assets, when the feature is off, no frontend is
// selected, the selection is invalid, or that dev server cannot be reached. The target is built
// only from the configured template and a validated DNS label, never from the request.
func WorktreeAssets(ctx context.Context, req *http.Request, cfg *setting.Cfg) *dtos.EntryPointAssets {
	if cfg.Env != setting.Dev || cfg.FrontendDevWorktreeServerURLTemplate == "" {
		return nil
	}
	values := req.Header.Values(FrontendHeader)
	if len(values) == 0 {
		return nil
	}
	if len(values) != 1 || !frontendName.MatchString(values[0]) {
		logger.Warn("Ignoring invalid frontend selection header", "header", FrontendHeader)
		return nil
	}

	baseURL := fmt.Sprintf(cfg.FrontendDevWorktreeServerURLTemplate, values[0])
	baseURL = strings.TrimSuffix(baseURL, "/") + "/"

	ctx, cancel := context.WithTimeout(ctx, devServerManifestTimeout)
	defer cancel()
	assets, err := ReadWebAssetsFromCDN(ctx, BuildDir, baseURL)
	if err != nil {
		logger.Debug("Could not read the selected frontend's manifest, using the default assets",
			"frontend", values[0], "error", err)
		return nil
	}
	return assets
}
