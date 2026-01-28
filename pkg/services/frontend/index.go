package frontend

import (
	"embed"
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"syscall"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

type IndexProvider struct {
	log          logging.Logger
	index        *template.Template
	hooksService *hooks.HooksService
	config       *setting.Cfg
	assets       dtos.EntryPointAssets // Includes CDN info
}

type IndexViewData struct {
	IsDevelopmentEnv bool

	Config *setting.Cfg // TODO: remove and get from request config?

	AppTitle  string // TODO: remove and get from request config?
	AppSubUrl string // TODO: remove and get from request config?

	Settings FSFrontendSettings

	Assets      dtos.EntryPointAssets // Includes CDN info
	DefaultUser dtos.CurrentUser

	// Nonce is a cryptographic identifier for use with Content Security Policy.
	Nonce string

	PublicDashboardAccessToken string
}

// Templates setup.
var (
	//go:embed *.html
	templatesFS embed.FS

	// templates
	htmlTemplates = template.Must(template.New("html").Delims("[[", "]]").ParseFS(templatesFS, `*.html`))
)

func NewIndexProvider(cfg *setting.Cfg, assetsManifest dtos.EntryPointAssets, license licensing.Licensing, hooksService *hooks.HooksService) (*IndexProvider, error) {
	t := htmlTemplates.Lookup("index.html")
	if t == nil {
		return nil, fmt.Errorf("missing index template")
	}

	logger := logging.DefaultLogger.With("logger", "index-provider")

	// subset of frontend settings needed for the login page
	// TODO what about enterprise settings here?

	return &IndexProvider{
		log:          logger,
		index:        t,
		hooksService: hooksService,
		config:       cfg,
		assets:       assetsManifest,
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

	reqCtx := contexthandler.FromContext(ctx)

	// make a copy of the settings
	fsSettings := requestConfig.FSFrontendSettings

	data := IndexViewData{
		AppTitle:                   "Grafana",
		AppSubUrl:                  p.config.AppSubURL,
		IsDevelopmentEnv:           p.config.Env == setting.Dev,
		Assets:                     p.assets,
		DefaultUser:                dtos.CurrentUser{},
		Nonce:                      reqCtx.RequestNonce,
		PublicDashboardAccessToken: reqCtx.PublicDashboardAccessToken,
		Settings:                   fsSettings,
	}

	// TODO -- reevaluate with mt authnz
	// Check for login_error cookie and set a generic error message.
	// The backend sets an encrypted cookie on oauth login failures that we can't read
	// so we just show a generic error if the cookie is present.
	if cookie, err := request.Cookie("login_error"); err == nil && cookie.Value != "" {
		p.log.Info("request has login_error cookie")
		// Defaults to a translation key that the frontend will resolve to a localized message
		data.Settings.LoginError = p.config.OAuthLoginErrorMessage // TODO: get from request config

		cookiePath := "/"
		if p.config.AppSubURL != "" {
			cookiePath = p.config.AppSubURL
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
