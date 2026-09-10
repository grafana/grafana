package frontend

import (
	"context"
	"embed"
	"encoding/hex"
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"os"
	"path/filepath"
	"syscall"

	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	fswebassets "github.com/grafana/grafana/pkg/services/frontend/webassets"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
)

type IndexProvider struct {
	log          logging.Logger
	index        *template.Template
	hooksService *hooks.HooksService
	config       *setting.Cfg
	license      licensing.Licensing
	previewCfg   fswebassets.PreviewAssetsConfig

	// bootScripts is keyed by build directory, read at startup so the per-request
	// lookup never touches disk.
	bootScripts map[string]template.JS
}

type IndexViewData struct {
	IsDevelopmentEnv bool

	Config *setting.Cfg // TODO: remove and get from request config?

	AppTitle  string // TODO: remove and get from request config?
	AppSubUrl string // TODO: remove and get from request config?

	Settings     FSFrontendSettings
	FullSettings *dtos.FrontendSettingsDTO // used behind feature flag instead of Settings

	Assets      dtos.EntryPointAssets // Includes CDN info
	DefaultUser dtos.CurrentUser

	// Set when Assets come from a preview build (see preview_assets.go).
	PreviewAssetsFolder string

	// Nonce is a cryptographic identifier for use with Content Security Policy.
	Nonce string

	PublicDashboardAccessToken string

	// Feature flag for image-renderer to check support for binding calls
	RenderBindingSupported bool

	// Feature flag for selecting the Luxon-backed date-time implementation
	UseLuxon bool

	// Options for controlling the inclusion and behavior of the Meticulous AI session recorder script.
	MeticulousAIEnabled                   bool
	MeticulousAIRecordingToken            string
	MeticulousAIProductionEnvironmentFlag bool

	BootScript template.JS

	// Feature flag for enabling SRI checks on Grafana assets
	AssetSriChecksEnabled bool

	// Feature flag for reducing the usage of Bootdata
	ReduceBootdataAPI bool

	// Feature flag for controlling behaviour of blocking or alerting legacy api usage from the frontend
	LegacyAPIMode string

	// Feature flag for gradually rolling out the root /ofrep/v1 OFREP route instead of the namespaced route
	OFREPRootUrlEnabled bool
}

// Templates setup.
var (
	//go:embed index.html
	templatesFS embed.FS

	// templates
	htmlTemplates = template.Must(template.New("html").Delims("[[", "]]").ParseFS(templatesFS, `index.html`))
)

func NewIndexProvider(cfg *setting.Cfg, license licensing.Licensing, hooksService *hooks.HooksService, previewCfg fswebassets.PreviewAssetsConfig) (*IndexProvider, error) {
	t := htmlTemplates.Lookup("index.html")
	if t == nil {
		return nil, fmt.Errorf("missing index template")
	}

	logger := logging.DefaultLogger.With("logger", "index-provider")

	// Either build may be absent; selecting one that is fails the request, not startup.
	bootScripts := make(map[string]template.JS, 2)
	for _, dir := range []string{webassets.BuildDir, webassets.RspackBuildDir} {
		//nolint:gosec
		raw, err := os.ReadFile(filepath.Join(cfg.StaticRootPath, dir, "boot.js"))
		if err != nil {
			logger.Info("no boot script for build directory, skipping", "dir", dir, "err", err)
			continue
		}
		//nolint:gosec
		bootScripts[dir] = template.JS(raw)
	}
	if len(bootScripts) == 0 {
		return nil, fmt.Errorf("no boot script found under %s", filepath.Join(cfg.StaticRootPath, webassets.BuildDir))
	}

	// subset of frontend settings needed for the login page
	// TODO what about enterprise settings here?

	return &IndexProvider{
		log:          logger,
		index:        t,
		hooksService: hooksService,
		config:       cfg,
		license:      license,
		previewCfg:   previewCfg,
		bootScripts:  bootScripts,
	}, nil
}

func (p *IndexProvider) HandleRequest(writer http.ResponseWriter, request *http.Request) {
	ctx, span := tracer.Start(request.Context(), "frontend.index.HandleRequest")
	defer span.End()

	if request.Method != "GET" {
		writer.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	requestConfig, err := FSRequestConfigFromContext(ctx)
	if err != nil {
		p.log.Error("unable to get request config", "err", err)
		http.Error(writer, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	buildDir := webassets.ResolveBuildDir(ctx)
	bootScript, ok := p.bootScripts[buildDir]
	if !ok {
		p.log.Error("no boot script for the selected build directory", "dir", buildDir)
		http.Error(writer, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	assetsManifest, previewFolder, err := p.resolveAssets(ctx, request, buildDir)
	if err != nil {
		p.log.Error("unable to get web assets", "err", err)
		http.Error(writer, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	reqCtx := contexthandler.FromContext(ctx)

	// make a copy of the settings
	fsSettings := requestConfig.FSFrontendSettings

	ofClient := openfeature.NewDefaultClient()
	renderBindingSupported, _ := ofClient.BooleanValue(ctx, featuremgmt.FlagReportRenderBinding, false, openfeature.TransactionContext(ctx))
	useLuxon, _ := ofClient.BooleanValue(ctx, featuremgmt.FlagDatetimeUseLuxon, false, openfeature.TransactionContext(ctx))
	grafanaAssetSriChecks, _ := ofClient.BooleanValue(ctx, featuremgmt.FlagGrafanaAssetSriChecks, false, openfeature.TransactionContext(ctx))
	meticulousAIMode, _ := ofClient.StringValue(ctx, featuremgmt.FlagGrafanaMeticulousAIMode, "off", openfeature.TransactionContext(ctx))
	meticulousAIEnabled := meticulousAIMode == "on-prod-env" || meticulousAIMode == "on-dev-env"
	meticulousAIProductionEnvironmentFlag := meticulousAIMode == "on-prod-env"
	reduceBootdataAPI := requestConfig.FullFrontendSettings != nil
	legacyAPIMode, _ := ofClient.StringValue(ctx, featuremgmt.FlagGrafanaFrontendLegacyAPIHandling, "off", openfeature.TransactionContext(ctx))
	ofrepRootUrlEnabled := ofClient.Boolean(ctx, featuremgmt.FlagGrafanaOfrepRootUrl, false, openfeature.TransactionContext(ctx))

	data := IndexViewData{
		AppTitle:                              "Grafana",
		AppSubUrl:                             p.config.AppSubURL,
		IsDevelopmentEnv:                      p.config.Env == setting.Dev,
		Assets:                                assetsManifest,
		PreviewAssetsFolder:                   previewFolder,
		DefaultUser:                           dtos.CurrentUser{},
		Nonce:                                 reqCtx.RequestNonce,
		PublicDashboardAccessToken:            reqCtx.PublicDashboardAccessToken,
		Settings:                              fsSettings,
		FullSettings:                          requestConfig.FullFrontendSettings, // only populated when FlagFrontendServiceReducedBootDataAPI enabled
		RenderBindingSupported:                renderBindingSupported,
		UseLuxon:                              useLuxon,
		AssetSriChecksEnabled:                 grafanaAssetSriChecks,
		MeticulousAIEnabled:                   meticulousAIEnabled,
		MeticulousAIRecordingToken:            p.config.MeticulousAIRecordingToken,
		MeticulousAIProductionEnvironmentFlag: meticulousAIProductionEnvironmentFlag,
		ReduceBootdataAPI:                     reduceBootdataAPI,
		BootScript:                            bootScript,
		LegacyAPIMode:                         legacyAPIMode,
		OFREPRootUrlEnabled:                   ofrepRootUrlEnabled,
	}

	// Check for login_error cookie. Two writers exist:
	//  1. OSS HTTPServer writes hex-encoded encrypted values (trySetEncryptedCookie).
	//  2. The multi-tenant authn-service writes plain-text error messages.
	// If the value is valid hex, it's the encrypted form and we can't decrypt it here,
	// so we fall back to the generic OAuthLoginErrorMessage. Otherwise, use the
	// plain-text value directly.
	if cookie, err := request.Cookie("login_error"); err == nil && cookie.Value != "" {
		p.log.Info("request has login_error cookie")
		if _, hexErr := hex.DecodeString(cookie.Value); hexErr != nil {
			data.Settings.LoginError = cookie.Value
		} else {
			data.Settings.LoginError = p.config.OAuthLoginErrorMessage
		}

		cookiePath := "/"
		if p.config.AppSubURL != "" {
			cookiePath = data.AppSubUrl
		}
		// #nosec G124 -- HttpOnly/Secure/SameSite are explicitly set above
		http.SetCookie(writer, &http.Cookie{
			Name:     "login_error",
			Value:    "",
			Path:     cookiePath,
			MaxAge:   -1,
			HttpOnly: true,
			Secure:   p.config.CookieSecure,
			SameSite: p.config.CookieSameSiteMode,
		})
	}

	p.runIndexDataHooks(reqCtx, &data)

	writer.Header().Set("Content-Type", "text/html; charset=UTF-8")
	writer.Header().Set("Cache-Control", "no-store")
	writer.WriteHeader(200)
	if err := p.index.Execute(writer, &data); err != nil {
		if errors.Is(err, syscall.EPIPE) { // Client has stopped listening.
			return
		}
		panic(fmt.Sprintf("Error rendering index\n %s", err.Error()))
	}
}

// resolveAssets returns the preview build's assets when a valid preview cookie is
// present, falling back to the default assets so a stale cookie can't break the page.
func (p *IndexProvider) resolveAssets(ctx context.Context, req *http.Request, buildDir string) (dtos.EntryPointAssets, string, error) {
	// The cookie only takes effect on stacks that have opted in.
	if p.previewCfg.Active(k8srequest.NamespaceValue(ctx)) {
		if cookie, err := req.Cookie(previewAssetsCookieName); err == nil && cookie.Value != "" {
			assets, err := fswebassets.GetPreviewWebAssets(ctx, p.previewCfg, cookie.Value)
			if err == nil {
				p.log.Info("resolved preview assets", "folder", cookie.Value)
				return assets, cookie.Value, nil
			}
			p.log.Warn("unable to load preview assets, falling back to default assets", "folder", cookie.Value, "err", err)
		}
	}

	assets, err := fswebassets.GetWebAssets(ctx, p.config, p.license, buildDir)
	return assets, "", err
}

func (p *IndexProvider) runIndexDataHooks(reqCtx *contextmodel.ReqContext, data *IndexViewData) {
	// Create a dummy struct to pass to the hooks, and then extract the data back out from it
	legacyIndexViewData := dtos.IndexViewData{
		Settings: &dtos.FrontendSettingsDTO{
			BuildInfo: data.Settings.BuildInfo,
			Licensing: &dtos.FrontendSettingsLicensingDTO{},
		},
	}

	p.hooksService.RunIndexDataHooks(&legacyIndexViewData, reqCtx)

	data.Settings.BuildInfo = legacyIndexViewData.Settings.BuildInfo

	if data.FullSettings != nil {
		data.FullSettings.Licensing = legacyIndexViewData.Settings.Licensing
	}
}
