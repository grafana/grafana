package webassets

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/httpclient"
)

type ManifestInfo struct {
	FilePath  string `json:"src,omitempty"`
	Integrity string `json:"integrity,omitempty"`

	// The known entrypoints
	App     *EntryPointInfo `json:"app,omitempty"`
	Dark    *EntryPointInfo `json:"dark,omitempty"`
	Light   *EntryPointInfo `json:"light,omitempty"`
	Swagger *EntryPointInfo `json:"swagger,omitempty"`
}

type EntryPointInfo struct {
	Assets struct {
		JS  []string `json:"js,omitempty"`
		CSS []string `json:"css,omitempty"`
	} `json:"assets,omitempty"`
}

var (
	entryPointAssetsCacheMu sync.RWMutex           // guard entryPointAssetsCache
	entryPointAssetsCache   *dtos.EntryPointAssets // TODO: get rid of global state
	httpClient              = httpclient.New()
)

func GetWebAssets(ctx context.Context, cfg *setting.Cfg, license licensing.Licensing) (*dtos.EntryPointAssets, error) {
	entryPointAssetsCacheMu.RLock()
	ret := entryPointAssetsCache
	entryPointAssetsCacheMu.RUnlock()

	if cfg.Env != setting.Dev && ret != nil {
		return ret, nil
	}
	entryPointAssetsCacheMu.Lock()
	defer entryPointAssetsCacheMu.Unlock()

	var err error
	var result *dtos.EntryPointAssets

	cdn := "" // "https://grafana-assets.grafana.net/grafana/10.3.0-64123/"
	if cdn != "" {
		result, err = readWebAssetsFromCDN(ctx, cdn)
	}

	if result == nil {
		result, err = ReadWebAssetsFromFile(filepath.Join(cfg.StaticRootPath, "build", "assets-manifest.json"))
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

func ReadWebAssetsFromFile(manifestpath string) (*dtos.EntryPointAssets, error) {
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
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"public/build/assets-manifest.json", nil)
	if err != nil {
		return nil, err
	}
	response, err := httpClient.Do(req)
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

func readWebAssets(r io.Reader) (*dtos.EntryPointAssets, error) {
	manifest := map[string]ManifestInfo{}
	if err := json.NewDecoder(r).Decode(&manifest); err != nil {
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
		return nil, fmt.Errorf("missing app entry, try running `yarn build`")
	}
	if entryPoints.Dark == nil || len(entryPoints.Dark.Assets.CSS) == 0 {
		return nil, fmt.Errorf("missing dark entry, try running `yarn build`")
	}
	if entryPoints.Light == nil || len(entryPoints.Light.Assets.CSS) == 0 {
		return nil, fmt.Errorf("missing light entry, try running `yarn build`")
	}
	if entryPoints.Swagger == nil || len(entryPoints.Swagger.Assets.JS) == 0 {
		return nil, fmt.Errorf("missing swagger entry, try running `yarn build`")
	}

	rsp := &dtos.EntryPointAssets{
		JSFiles:         make([]dtos.EntryPointAsset, 0, len(entryPoints.App.Assets.JS)),
		CSSFiles:        make([]dtos.EntryPointAsset, 0, len(entryPoints.App.Assets.CSS)),
		Dark:            entryPoints.Dark.Assets.CSS[0],
		Light:           entryPoints.Light.Assets.CSS[0],
		Swagger:         make([]dtos.EntryPointAsset, 0, len(entryPoints.Swagger.Assets.JS)),
		SwaggerCSSFiles: make([]dtos.EntryPointAsset, 0, len(entryPoints.Swagger.Assets.CSS)),
	}

	for _, entry := range entryPoints.App.Assets.JS {
		rsp.JSFiles = append(rsp.JSFiles, dtos.EntryPointAsset{
			FilePath:  entry,
			Integrity: integrity[entry],
		})
	}
	for _, entry := range entryPoints.App.Assets.CSS {
		rsp.CSSFiles = append(rsp.CSSFiles, dtos.EntryPointAsset{
			FilePath:  entry,
			Integrity: integrity[entry],
		})
	}
	for _, entry := range entryPoints.Swagger.Assets.JS {
		rsp.Swagger = append(rsp.Swagger, dtos.EntryPointAsset{
			FilePath:  entry,
			Integrity: integrity[entry],
		})
	}
	for _, entry := range entryPoints.Swagger.Assets.CSS {
		rsp.SwaggerCSSFiles = append(rsp.SwaggerCSSFiles, dtos.EntryPointAsset{
			FilePath:  entry,
			Integrity: integrity[entry],
		})
	}
	return rsp, nil
}
