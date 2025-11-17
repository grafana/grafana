package frontend

import (
	"embed"
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"strings"
	"syscall"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

type IndexProvider struct {
	log          logging.Logger
	index        *template.Template
	data         IndexViewData
	hooksService *hooks.HooksService
}

type IndexViewData struct {
	CSPContent           string
	CSPReportOnlyContent string
	CSPEnabled           bool
	IsDevelopmentEnv     bool

	Config *setting.Cfg

	AppSubUrl    string
	BuildVersion string
	BuildCommit  string
	AppTitle     string

	Assets      dtos.EntryPointAssets // Includes CDN info
	Settings    FSFrontendSettings
	DefaultUser dtos.CurrentUser

	// Nonce is a cryptographic identifier for use with Content Security Policy.
	Nonce string
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
	frontendSettings := FSFrontendSettings{
		AnalyticsConsoleReporting:            cfg.FrontendAnalyticsConsoleReporting,
		AnonymousEnabled:                     cfg.Anonymous.Enabled,
		ApplicationInsightsConnectionString:  cfg.ApplicationInsightsConnectionString,
		ApplicationInsightsEndpointUrl:       cfg.ApplicationInsightsEndpointUrl,
		ApplicationInsightsAutoRouteTracking: cfg.ApplicationInsightsAutoRouteTracking,
		AuthProxyEnabled:                     cfg.AuthProxy.Enabled,
		AutoAssignOrg:                        cfg.AutoAssignOrg,
		CSPReportOnlyEnabled:                 cfg.CSPReportOnlyEnabled,
		DisableLoginForm:                     cfg.DisableLoginForm,
		DisableUserSignUp:                    !cfg.AllowUserSignUp,
		GoogleAnalytics4Id:                   cfg.GoogleAnalytics4ID,
		GoogleAnalytics4SendManualPageViews:  cfg.GoogleAnalytics4SendManualPageViews,
		GoogleAnalyticsId:                    cfg.GoogleAnalyticsID,
		GrafanaJavascriptAgent:               cfg.GrafanaJavascriptAgent,
		Http2Enabled:                         cfg.Protocol == setting.HTTP2Scheme,
		JwtHeaderName:                        cfg.JWTAuth.HeaderName,
		JwtUrlLogin:                          cfg.JWTAuth.URLLogin,
		LdapEnabled:                          cfg.LDAPAuthEnabled,
		LoginHint:                            cfg.LoginHint,
		PasswordHint:                         cfg.PasswordHint,
		ReportingStaticContext:               cfg.ReportingStaticContext,
		RudderstackConfigUrl:                 cfg.RudderstackConfigURL,
		RudderstackDataPlaneUrl:              cfg.RudderstackDataPlaneURL,
		RudderstackIntegrationsUrl:           cfg.RudderstackIntegrationsURL,
		RudderstackSdkUrl:                    cfg.RudderstackSDKURL,
		RudderstackWriteKey:                  cfg.RudderstackWriteKey,
		TrustedTypesDefaultPolicyEnabled:     (cfg.CSPEnabled && strings.Contains(cfg.CSPTemplate, "require-trusted-types-for")) || (cfg.CSPReportOnlyEnabled && strings.Contains(cfg.CSPReportOnlyTemplate, "require-trusted-types-for")),
		VerifyEmailEnabled:                   cfg.VerifyEmailEnabled,
		BuildInfo:                            getBuildInfo(license, cfg),
	}

	return &IndexProvider{
		log:          logger,
		index:        t,
		hooksService: hooksService,
		data: IndexViewData{
			AppTitle:     "Grafana",
			AppSubUrl:    cfg.AppSubURL, // Based on the request?
			BuildVersion: cfg.BuildVersion,
			BuildCommit:  cfg.BuildCommit,
			Config:       cfg,

			CSPEnabled:           cfg.CSPEnabled,
			CSPContent:           cfg.CSPTemplate,
			CSPReportOnlyContent: cfg.CSPReportOnlyTemplate,

			IsDevelopmentEnv: cfg.Env == setting.Dev,

			Assets:      assetsManifest,
			Settings:    frontendSettings,
			DefaultUser: dtos.CurrentUser{},
		},
	}, nil
}

func (p *IndexProvider) HandleRequest(writer http.ResponseWriter, request *http.Request) {
	ctx, span := tracer.Start(request.Context(), "frontend.index.HandleRequest")
	defer span.End()

	if request.Method != "GET" {
		writer.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	nonce, err := middleware.GenerateNonce()
	if err != nil {
		p.log.Error("error creating nonce", "err", err)
		writer.WriteHeader(500)
		return
	}

	// TODO -- restructure so the static stuff is under one variable and the rest is dynamic
	data := p.data // copy everything
	data.Nonce = nonce

	if data.CSPEnabled {
		data.CSPContent = middleware.ReplacePolicyVariables(p.data.CSPContent, p.data.AppSubUrl, data.Nonce)
		writer.Header().Set("Content-Security-Policy", data.CSPContent)

		policy := middleware.ReplacePolicyVariables(p.data.CSPReportOnlyContent, p.data.AppSubUrl, data.Nonce)
		writer.Header().Set("Content-Security-Policy-Report-Only", policy)
	}

	reqCtx := contexthandler.FromContext(ctx)
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

func getBuildInfo(license licensing.Licensing, cfg *setting.Cfg) dtos.FrontendSettingsBuildInfoDTO {
	version := setting.BuildVersion
	commit := setting.BuildCommit
	commitShort := getShortCommitHash(setting.BuildCommit, 10)
	buildstamp := setting.BuildStamp
	versionString := fmt.Sprintf(`%s v%s (%s)`, setting.ApplicationName, version, commitShort)

	buildInfo := dtos.FrontendSettingsBuildInfoDTO{
		Version:       version,
		VersionString: versionString,
		Commit:        commit,
		CommitShort:   commitShort,
		Buildstamp:    buildstamp,
		Edition:       license.Edition(),
		Env:           cfg.Env,
	}

	return buildInfo
}

func getShortCommitHash(commitHash string, maxLength int) string {
	if len(commitHash) > maxLength {
		return commitHash[:maxLength]
	}
	return commitHash
}
