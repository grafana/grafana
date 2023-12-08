package webassets

import (
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

func GetWebAssets(cfg *setting.Cfg, license licensing.Licensing) (*dtos.EntryPointAssets, error) {
	if cfg.Env != setting.Dev && entryPointAssetsCache != nil {
		return entryPointAssetsCache, nil
	}

	var err error
	var result *dtos.EntryPointAssets

	cdn := "" // "https://grafana-assets.grafana.net/grafana/10.3.0-64123/"
	if cdn != "" {
		result, err = readWebAssetsFromCDN(cdn)
	}

	if result == nil {
		result, err = readWebAssetsFromFile(filepath.Join(cfg.StaticRootPath, "build", "assets-manifest.json"))
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
	bytes, err := os.ReadFile(manifestpath)
	if err != nil {
		return nil, fmt.Errorf("failed to load assets-manifest.json %w", err)
	}
	return readWebAssets(bytes)
}

func readWebAssetsFromCDN(baseURL string) (*dtos.EntryPointAssets, error) {
	response, err := http.Get(baseURL + "public/build/assets-manifest.json")
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = response.Body.Close()
	}()
	bytes, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}
	dto, err := readWebAssets(bytes)
	if err == nil {
		dto.SetContentDeliveryURL(baseURL)
	}
	return dto, err
}

func readWebAssets(bytes []byte) (*dtos.EntryPointAssets, error) {
	manifest := map[string]ManifestInfo{}
	err := json.Unmarshal(bytes, &manifest)
	if err != nil {
		return nil, fmt.Errorf("failed to read assets-manifest.json %w", err)
	}

	integrity := make(map[string]string, 100)
	for _, v := range manifest {
		if v.Integrity != "" && v.FilePath != "" {
			integrity[v.FilePath] = v.Integrity
		}
	}

	entryPoints, ok := manifest["entrypoints"]
	if !ok {
		return nil, fmt.Errorf("could not find entrypoints in asssets-manifest")
	}

	if entryPoints.App == nil || len(entryPoints.App.Assets.JS) == 0 {
		return nil, fmt.Errorf("missing app entry")
	}
	if entryPoints.Dark == nil || len(entryPoints.Dark.Assets.CSS) == 0 {
		return nil, fmt.Errorf("missing dark entry")
	}
	if entryPoints.Light == nil || len(entryPoints.Light.Assets.CSS) == 0 {
		return nil, fmt.Errorf("missing light entry")
	}

	entryPointJSAssets := make([]dtos.EntryPointAsset, 0)
	for _, entry := range entryPoints.App.Assets.JS {
		entryPointJSAssets = append(entryPointJSAssets, dtos.EntryPointAsset{
			FilePath:  entry,
			Integrity: integrity[entry],
		})
	}

	return &dtos.EntryPointAssets{
		JSFiles: entryPointJSAssets,
		Dark:    entryPoints.Dark.Assets.CSS[0],
		Light:   entryPoints.Light.Assets.CSS[0],
	}, nil
}
