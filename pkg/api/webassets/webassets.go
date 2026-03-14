package webassets

import (
	"context"
	"net/http"
	"path/filepath"
	"sync"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/httpclient"
	assetsmanifest "github.com/grafana/grafana/pkg/webassets/manifest"
	"github.com/open-feature/go-sdk/openfeature"
)

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

	if result == nil {
		result, err = ReadWebAssetsFromFile(filepath.Join(cfg.StaticRootPath, "build", assetsFilename))
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

func ReadWebAssetsFromFile(manifestPath string) (*dtos.EntryPointAssets, error) {
	assets, err := assetsmanifest.ReadFromFile(manifestPath)
	if err != nil {
		return nil, err
	}

	return toDTOAssets(assets), nil
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
	dto, err := assetsmanifest.Read(response.Body)
	if err == nil {
		converted := toDTOAssets(dto)
		converted.SetContentDeliveryURL(baseURL)
		return converted, nil
	}

	return nil, err
}

func toDTOAssets(assets *assetsmanifest.EntryPointAssets) *dtos.EntryPointAssets {
	rsp := &dtos.EntryPointAssets{
		JSFiles:         make([]dtos.EntryPointAsset, 0, len(assets.JSFiles)),
		CSSFiles:        make([]dtos.EntryPointAsset, 0, len(assets.CSSFiles)),
		Dark:            assets.Dark,
		Light:           assets.Light,
		Swagger:         make([]dtos.EntryPointAsset, 0, len(assets.Swagger)),
		SwaggerCSSFiles: make([]dtos.EntryPointAsset, 0, len(assets.SwaggerCSSFiles)),
	}

	for _, entry := range assets.JSFiles {
		rsp.JSFiles = append(rsp.JSFiles, dtos.EntryPointAsset{
			FilePath:  entry.FilePath,
			Integrity: entry.Integrity,
		})
	}
	for _, entry := range assets.CSSFiles {
		rsp.CSSFiles = append(rsp.CSSFiles, dtos.EntryPointAsset{
			FilePath:  entry.FilePath,
			Integrity: entry.Integrity,
		})
	}
	for _, entry := range assets.Swagger {
		rsp.Swagger = append(rsp.Swagger, dtos.EntryPointAsset{
			FilePath:  entry.FilePath,
			Integrity: entry.Integrity,
		})
	}
	for _, entry := range assets.SwaggerCSSFiles {
		rsp.SwaggerCSSFiles = append(rsp.SwaggerCSSFiles, dtos.EntryPointAsset{
			FilePath:  entry.FilePath,
			Integrity: entry.Integrity,
		})
	}
	return rsp
}
