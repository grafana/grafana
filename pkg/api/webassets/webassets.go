package webassets

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

type ManifestInfo struct {
	FilePath  string `json:"src,omitempty"`
	Integrity string `json:"integrity,omitempty"`

	// The known entrypoints
	App   *EntryPointInfo `json:"app,omitempty"`
	Dark  *EntryPointInfo `json:"dark,omitempty"`
	Light *EntryPointInfo `json:"light,omitempty"`
}

type EntryPointInfo struct {
	Assets struct {
		JS  []string `json:"js,omitempty"`
		CSS []string `json:"css,omitempty"`
	} `json:"assets,omitempty"`
}

var entryPointAssetsCache *dtos.EntryPointAssets = nil

func GetWebAssets(ctx context.Context, cfg *setting.Cfg, license licensing.Licensing) (*dtos.EntryPointAssets, error) {
	if cfg.Env == setting.Dev && cfg.FrontendDevServer != "" {
		// TODO: Hardcoded right now just to get vite dev env working.
		// see https://vitejs.dev/guide/backend-integration.html
		// Not sure we can rely on env config === dev alone as it's used in prod envs.
		viteDev := &dtos.EntryPointAssets{
			JSFiles: []dtos.EntryPointAsset{
				{
					FilePath:  fmt.Sprintf("%s/@vite/client", cfg.FrontendDevServer),
					Integrity: "",
				},
				{
					FilePath:  fmt.Sprintf("%s/app/index.ts", cfg.FrontendDevServer),
					Integrity: "",
				},
			},
			Dark:  fmt.Sprintf("%s/sass/grafana.dark.scss", cfg.FrontendDevServer),
			Light: fmt.Sprintf("%s/sass/grafana.light.scss", cfg.FrontendDevServer),
		}

		return viteDev, nil
	}

	if cfg.Env != setting.Dev && entryPointAssetsCache != nil {
		return entryPointAssetsCache, nil
	}

	var err error
	var result *dtos.EntryPointAssets

	cdn := "" // "https://grafana-assets.grafana.net/grafana/10.3.0-64123/"
	if cdn != "" {
		result, err = readWebAssetsFromCDN(ctx, cdn)
	}

	if result == nil {
		result, err = readWebAssetsFromFile(filepath.Join(cfg.StaticRootPath, "build", ".vite", "manifest.json"))
		if err == nil {
			cdn, _ = cfg.GetContentDeliveryURL(license.ContentDeliveryPrefix())
			if cdn != "" {
				result.SetContentDeliveryURL(cdn)
			}
		}
	}

	entryPointAssetsCache = result
	return entryPointAssetsCache, err
}

func readWebAssetsFromFile(manifestpath string) (*dtos.EntryPointAssets, error) {
	//nolint:gosec
	f, err := os.Open(manifestpath)
	if err != nil {
		return nil, fmt.Errorf("failed to load assets-manifest.json %w", err)
	}
	defer func() {
		_ = f.Close()
	}()
	return readWebAssets(f)
}

func readWebAssetsFromCDN(ctx context.Context, baseURL string) (*dtos.EntryPointAssets, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"public/build/.vite/manifest.json", nil)
	if err != nil {
		return nil, err
	}
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = response.Body.Close()
	}()
	dto, err := readWebAssets(response.Body)
	if err == nil {
		dto.SetContentDeliveryURL(baseURL)
	}
	return dto, err
}

// ViteManifestEntry represents a single entry in the Vite manifest.
type ViteManifestEntry struct {
	File           string   `json:"file"`
	Imports        []string `json:"imports"`
	IsDynamicEntry bool     `json:"isDynamicEntry"`
	IsEntry        bool     `json:"isEntry"`
	Src            string   `json:"src"`
}

func readWebAssets(r io.Reader) (*dtos.EntryPointAssets, error) {
	manifest := map[string]ViteManifestEntry{}
	if err := json.NewDecoder(r).Decode(&manifest); err != nil {
		return nil, fmt.Errorf("failed to read assets-manifest.json %w", err)
	}

	var entryPointJSAssets []dtos.EntryPointAsset
	var darkCSS, lightCSS string

	for _, entry := range manifest {
		if entry.IsEntry {
			if filepath.Ext(entry.File) != ".css" {
				asset := dtos.EntryPointAsset{
					FilePath: entry.File,
					// Not sure what should happen with integrity here
					Integrity: "",
				}
				entryPointJSAssets = append(entryPointJSAssets, asset)
			}
			if entry.Src == "sass/grafana.dark.scss" && entry.IsEntry {
				darkCSS = entry.File
			}
			if entry.Src == "sass/grafana.light.scss" && entry.IsEntry {
				lightCSS = entry.File
			}
		}
	}

	return &dtos.EntryPointAssets{
		JSFiles: entryPointJSAssets,
		Dark:    darkCSS,
		Light:   lightCSS,
	}, nil
}
