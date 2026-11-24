package webassets

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/httpclient"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/api/webassets")

// Not cfg.Logger: callers construct Cfg as a struct literal in tests, leaving it nil.
var logger = log.New("webassets")

const (
	BuildDir = "build"

	AssetsManifestFile = "assets-manifest.json"
)

// PublicPathFor returns the URL prefix assets in buildDir are referenced by. It must
// match the bundler's output.publicPath.
func PublicPathFor(buildDir string) string {
	return path.Join("public", buildDir) + "/"
}

type ManifestInfo struct {
	FilePath  string `json:"src,omitempty"`
	Integrity string `json:"integrity,omitempty"`

	// The known entrypoints
	App   *EntryPointInfo `json:"app,omitempty"`
	Dark  *EntryPointInfo `json:"dark,omitempty"`
	Light *EntryPointInfo `json:"light,omitempty"`

	// ESModule is true when the bundler emitted ES modules rather than classic scripts.
	ESModule bool `json:"esModule,omitempty"`
}

type EntryPointInfo struct {
	Assets struct {
		JS  []string `json:"js,omitempty"`
		CSS []string `json:"css,omitempty"`
	} `json:"assets,omitempty"`
}

var (
	entryPointAssetsCacheMu sync.RWMutex                      // guard entryPointAssetsCache
	entryPointAssetsCache   map[string]*dtos.EntryPointAssets // TODO: get rid of global state
	httpClient              = httpclient.New()
)

func GetWebAssets(ctx context.Context, buildDir string, cfg *setting.Cfg, license licensing.Licensing) (*dtos.EntryPointAssets, error) {
	ctx, span := tracer.Start(ctx, "webassets.GetWebAssets")
	defer span.End()

	entryPointAssetsCacheMu.RLock()
	ret := entryPointAssetsCache[buildDir]
	entryPointAssetsCacheMu.RUnlock()

	if cfg.Env != setting.Dev && ret != nil {
		return ret, nil
	}
	// Deliberately fetched before taking the lock below: the dev server parks requests while it
	// compiles, and that lock is global, so holding it across the call would serialize every
	// concurrent render behind one rebuild.
	result := readDevServerAssets(ctx, buildDir, cfg)

	entryPointAssetsCacheMu.Lock()
	defer entryPointAssetsCacheMu.Unlock()

	var err error

	cdn := "" // "https://grafana-assets.grafana.net/grafana/10.3.0-64123/"
	if result == nil && cdn != "" {
		result, err = ReadWebAssetsFromCDN(ctx, buildDir, cdn)
	}

	if result == nil {
		result, err = ReadWebAssetsFromFile(filepath.Join(cfg.StaticRootPath, buildDir, AssetsManifestFile))
		if err == nil {
			result.PublicPath = PublicPathFor(buildDir)
			cdn, _ = cfg.GetContentDeliveryURL(license.ContentDeliveryPrefix())
			if cdn != "" {
				result.SetContentDeliveryURL(cdn)
			}
		}
	}

	if entryPointAssetsCache == nil {
		entryPointAssetsCache = make(map[string]*dtos.EntryPointAssets)
	}
	entryPointAssetsCache[buildDir] = result
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
	return entryPointAssetsCache[buildDir], err
}

// devServerManifestTimeout bounds the manifest fetch. The dev server holds a request open for
// the whole of an in-flight rebuild, so this is generous enough to ride one out but still
// returns rather than hanging the render on a listener that never answers.
const devServerManifestTimeout = 10 * time.Second

// The manifest lists initial chunks, not every lazy-loaded asset.
const (
	maxManifestSize         = 1024 * 1024
	maxEntrypointAssets     = 256
	maxAssetPathLength      = 4096
	maxAssetIntegrityLength = 512
)

func validateAssetPath(file string) error {
	if len(file) > maxAssetPathLength {
		return fmt.Errorf("assets-manifest.json asset path exceeds %d bytes", maxAssetPathLength)
	}
	// Bundlers emit public/build/... or public/build-swagger/... relative to the
	// server/CDN root. Never allow an asset to escape that root or become a URL.
	if file == "" || file == "." || file == ".." || path.IsAbs(file) ||
		path.Clean(file) != file || strings.HasPrefix(file, "../") || strings.ContainsAny(file, `\:%?#`) {
		return fmt.Errorf("assets-manifest.json asset path must be a clean relative path")
	}
	for i := range len(file) {
		if file[i] < 0x20 || file[i] == 0x7f {
			return fmt.Errorf("assets-manifest.json asset path contains a control character")
		}
	}
	return nil
}

// readDevServerAssets reads the manifest from a running bundler dev server, which stands in for
// the CDN: the browser then fetches bundles straight from it, which is what lets it hot-replace
// modules, and the dev server never has to write a build to disk. Returns nil when there is no
// dev server to read from, leaving the caller to use the build on disk. Only the main build
// has a dev server; the swagger build compiles to disk.
func readDevServerAssets(ctx context.Context, buildDir string, cfg *setting.Cfg) *dtos.EntryPointAssets {
	if cfg.Env != setting.Dev || cfg.FrontendDevServerURL == "" || buildDir != BuildDir {
		return nil
	}

	ctx, cancel := context.WithTimeout(ctx, devServerManifestTimeout)
	defer cancel()

	result, err := ReadWebAssetsFromCDN(ctx, buildDir, cfg.FrontendDevServerURL+"/")
	if err != nil {
		// Expected whenever the dev server is not running. Logged because a typo'd port, a 404
		// or a half-written manifest are otherwise indistinguishable from that, and all of them
		// surface only as a silently stale page.
		logger.Debug("Could not read the frontend manifest from the dev server, using the build on disk",
			"url", cfg.FrontendDevServerURL, "error", err)
		return nil
	}

	return result
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

func ReadWebAssetsFromCDN(ctx context.Context, buildDir string, baseURL string) (*dtos.EntryPointAssets, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+path.Join("public", buildDir, AssetsManifestFile), nil)
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
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code %d fetching assets-manifest.json from %s", response.StatusCode, baseURL)
	}
	dto, err := readWebAssets(response.Body)
	if err == nil {
		dto.PublicPath = PublicPathFor(buildDir)
		dto.SetContentDeliveryURL(baseURL)
	}
	return dto, err
}

func readWebAssets(r io.Reader) (*dtos.EntryPointAssets, error) {
	data, err := io.ReadAll(io.LimitReader(r, maxManifestSize+1))
	if err != nil {
		return nil, fmt.Errorf("failed to read assets-manifest.json: %w", err)
	}
	if len(data) > maxManifestSize {
		return nil, fmt.Errorf("assets-manifest.json exceeds %d bytes", maxManifestSize)
	}
	var manifest map[string]ManifestInfo
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("failed to parse assets-manifest.json: %w", err)
	}
	entryPoints := manifest["entrypoints"]
	if entryPoints.App == nil || len(entryPoints.App.Assets.JS) == 0 {
		return nil, fmt.Errorf("missing app entry, try running `pnpm build`")
	}

	if len(entryPoints.App.Assets.JS)+len(entryPoints.App.Assets.CSS) > maxEntrypointAssets {
		return nil, fmt.Errorf("assets-manifest.json exceeds %d entrypoint assets", maxEntrypointAssets)
	}

	integrity := make(map[string]string)
	for _, entry := range manifest {
		if len(entry.Integrity) > maxAssetIntegrityLength {
			return nil, fmt.Errorf("assets-manifest.json integrity exceeds %d bytes", maxAssetIntegrityLength)
		}
		if entry.FilePath != "" && entry.Integrity != "" {
			integrity[entry.FilePath] = entry.Integrity
		}
	}

	for _, files := range [2][]string{entryPoints.App.Assets.JS, entryPoints.App.Assets.CSS} {
		for _, file := range files {
			if err := validateAssetPath(file); err != nil {
				return nil, err
			}
		}
	}
	for _, theme := range [2]*EntryPointInfo{entryPoints.Dark, entryPoints.Light} {
		if theme != nil && len(theme.Assets.CSS) > 0 {
			if err := validateAssetPath(theme.Assets.CSS[0]); err != nil {
				return nil, err
			}
		}
	}

	rsp := &dtos.EntryPointAssets{
		ESModule: entryPoints.ESModule,
		JSFiles:  make([]dtos.EntryPointAsset, 0, len(entryPoints.App.Assets.JS)),
		CSSFiles: make([]dtos.EntryPointAsset, 0, len(entryPoints.App.Assets.CSS)),
	}
	if entryPoints.Dark != nil && len(entryPoints.Dark.Assets.CSS) > 0 {
		rsp.Dark = entryPoints.Dark.Assets.CSS[0]
	}
	if entryPoints.Light != nil && len(entryPoints.Light.Assets.CSS) > 0 {
		rsp.Light = entryPoints.Light.Assets.CSS[0]
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
	return rsp, nil
}
