package frontend

import (
	"embed"
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"syscall"

	"github.com/grafana/grafana/pkg/api/dtos"
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
	index             *template.Template
	hooksService      *hooks.HooksService
	config            *setting.Cfg
	license           licensing.Licensing
	assetsOverrideCfg AssetsOverrideConfig
}

type IndexViewData struct {
	IsDevelopmentEnv bool

	Config *setting.Cfg // TODO: remove and get from request config?

	AppTitle  string // TODO: remove and get from request config?
	AppSubUrl string // TODO: remove and get from request config?

	Settings FSFrontendSettings

	Assets           dtos.EntryPointAssets // Includes CDN info
	AssetsOverridden bool
	DefaultUser      dtos.CurrentUser

	// Nonce is a cryptographic identifier for use with Content Security Policy.
	Nonce string

	PublicDashboardAccessToken string

	// Feature flag for image-renderer to check support for binding calls
	RenderBindingSupported bool
}

// Templates setup.
var (
	//go:embed index.html
	templatesFS embed.FS

	// templates
	htmlTemplates = template.Must(template.New("html").Delims("[[", "]]").ParseFS(templatesFS, `index.html`))
)

func NewIndexProvider(cfg *setting.Cfg, license licensing.Licensing, hooksService *hooks.HooksService, previewAssetsCfg AssetsOverrideConfig) (*IndexProvider, error) {
	t := htmlTemplates.Lookup("index.html")
	if t == nil {
		return nil, fmt.Errorf("missing index template")
	}

	// subset of frontend settings needed for the login page
	// TODO what about enterprise settings here?

	return &IndexProvider{
		index:             t,
		hooksService:      hooksService,
		config:            cfg,
		license:           license,
		assetsOverrideCfg: previewAssetsCfg,
	}, nil
}

func (p *IndexProvider) HandleRequest(writer http.ResponseWriter, request *http.Request) {
	ctx, span := tracer.Start(request.Context(), "frontend.index.HandleRequest")
	defer span.End()
	reqCtx := contexthandler.FromContext(ctx)

	if request.Method != "GET" {
		writer.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	requestConfig, err := FSRequestConfigFromContext(ctx)
	if err != nil {
		reqCtx.Logger.Error("unable to get request config", "err", err)
		http.Error(writer, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Check for assets base override cookie (stores an asset ID, not a full URL)
	var assetsOverrideFolder string
	if p.assetsOverrideCfg.Enabled && p.assetsOverrideCfg.BaseURL != "" {
		if cookie, err := request.Cookie(assetsOverrideCookieName); err == nil && cookie.Value != "" {
			assetsOverrideFolder = cookie.Value
		}
	}

	assetsManifest, err := fswebassets.GetWebAssets(ctx, p.config, p.license, p.assetsOverrideCfg.Enabled, p.assetsOverrideCfg.BaseURL, assetsOverrideFolder)
	if err != nil {
		reqCtx.Logger.Error("unable to get web assets", "err", err)
		http.Error(writer, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// make a copy of the settings
	fsSettings := requestConfig.FSFrontendSettings

	ofClient := openfeature.NewDefaultClient()
	renderBindingSupported, _ := ofClient.BooleanValue(ctx, featuremgmt.FlagReportRenderBinding, false, openfeature.TransactionContext(ctx))

	data := IndexViewData{
		AppTitle:                   "Grafana",
		AppSubUrl:                  p.config.AppSubURL,
		IsDevelopmentEnv:           p.config.Env == setting.Dev,
		Assets:                     assetsManifest,
		AssetsOverridden:           assetsOverrideFolder != "",
		DefaultUser:                dtos.CurrentUser{},
		Nonce:                      reqCtx.RequestNonce,
		PublicDashboardAccessToken: reqCtx.PublicDashboardAccessToken,
		Settings:                   fsSettings,
		RenderBindingSupported:     renderBindingSupported,
	}

	// TODO -- reevaluate with mt authnz
	// Check for login_error cookie and set a generic error message.
	// The backend sets an encrypted cookie on oauth login failures that we can't read
	// so we just show a generic error if the cookie is present.
	if cookie, err := request.Cookie("login_error"); err == nil && cookie.Value != "" {
		reqCtx.Logger.Info("request has login_error cookie")
		// Defaults to a translation key that the frontend will resolve to a localized message
		data.Settings.LoginError = p.config.OAuthLoginErrorMessage // TODO: get from request config

		cookiePath := "/"
		if p.config.AppSubURL != "" {
			cookiePath = data.AppSubUrl
		}
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

func (p *IndexProvider) runIndexDataHooks(reqCtx *contextmodel.ReqContext, data *IndexViewData) {
	// Create a dummy struct to pass to the hooks, and then extract the data back out from it
	legacyIndexViewData := dtos.IndexViewData{
		Settings: &dtos.FrontendSettingsDTO{
			BuildInfo: data.Settings.BuildInfo,
		},
	}

	p.hooksService.RunIndexDataHooks(&legacyIndexViewData, reqCtx)

	data.Settings.BuildInfo = legacyIndexViewData.Settings.BuildInfo
}
