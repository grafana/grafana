package contextmodel

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/grafana/grafana/pkg/setting"
)

type errorAsset struct {
	FilePath string
}

type errorAssets struct {
	CSSFiles []errorAsset
	Dark     string
	Light    string
}

type manifestData struct {
	Entrypoints struct {
		App struct {
			Assets struct {
				CSS []string `json:"css"`
			} `json:"assets"`
		} `json:"app"`
		Dark struct {
			Assets struct {
				CSS []string `json:"css"`
			} `json:"assets"`
		} `json:"dark"`
		Light struct {
			Assets struct {
				CSS []string `json:"css"`
			} `json:"assets"`
		} `json:"light"`
	} `json:"entrypoints"`
}

var (
	errorAssetsMu    sync.RWMutex
	errorAssetsCache = make(map[string]*errorAssets)
)

func getErrorAssets(cfg *setting.Cfg) *errorAssets {
	if cfg == nil {
		return &errorAssets{
			CSSFiles: []errorAsset{},
		}
	}

	buildDir := "build"
	manifestPath := filepath.Join(cfg.StaticRootPath, buildDir, "assets-manifest.json")

	errorAssetsMu.RLock()
	cached, ok := errorAssetsCache[manifestPath]
	errorAssetsMu.RUnlock()
	if ok && cfg.Env != setting.Dev {
		return cached
	}

	errorAssetsMu.Lock()
	defer errorAssetsMu.Unlock()

	if cached, ok = errorAssetsCache[manifestPath]; ok && cfg.Env != setting.Dev {
		return cached
	}

	assets := &errorAssets{
		CSSFiles: []errorAsset{},
	}

	//nolint:gosec
	f, err := os.Open(manifestPath)
	if err != nil {
		errorAssetsCache[manifestPath] = assets
		return assets
	}
	defer func() {
		_ = f.Close()
	}()

	var manifest manifestData
	if err := json.NewDecoder(f).Decode(&manifest); err != nil {
		errorAssetsCache[manifestPath] = assets
		return assets
	}

	for _, css := range manifest.Entrypoints.App.Assets.CSS {
		assets.CSSFiles = append(assets.CSSFiles, errorAsset{FilePath: css})
	}
	if len(manifest.Entrypoints.Dark.Assets.CSS) > 0 {
		assets.Dark = manifest.Entrypoints.Dark.Assets.CSS[0]
	}
	if len(manifest.Entrypoints.Light.Assets.CSS) > 0 {
		assets.Light = manifest.Entrypoints.Light.Assets.CSS[0]
	}

	errorAssetsCache[manifestPath] = assets
	return assets
}
