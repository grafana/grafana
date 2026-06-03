package contextmodel

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type ReqContext struct {
	*web.Context
	*user.SignedInUser
	UserToken *usertoken.UserToken

	IsSignedIn     bool
	IsRenderCall   bool
	AllowAnonymous bool
	SkipDSCache    bool
	SkipQueryCache bool
	Logger         log.Logger
	Error          error
	// RequestNonce is a cryptographic request identifier for use with Content Security Policy.
	RequestNonce               string
	PublicDashboardAccessToken string

	PerfmonTimer   prometheus.Summary
	LookupTokenErr error

	// FIXME: Remove this temporary flag after the rollout of FlagUseSessionStorageForRedirection feature flag
	// Tracking issue for cleaning up this flag: https://github.com/grafana/identity-access-team/issues/908
	// UseSessionStorageRedirect is introduced to simplify the rollout of the new redirect logic
	UseSessionStorageRedirect bool
}

// errorPageAssets holds the CSS asset URLs needed by the error template.
type errorPageAssets struct {
	Dark  string
	Light string
}

// readManifestCSS extracts the hashed dark/light CSS paths from
// public/build/assets-manifest.json. Returns empty strings on any error;
// the caller should fall back to a static path.
func readManifestCSS(cfg *setting.Cfg) (dark, light string) {
	type entryPointAssets struct {
		Assets struct {
			CSS []string `json:"css"`
		} `json:"assets"`
	}
	type entryPoints struct {
		Dark  *entryPointAssets `json:"dark"`
		Light *entryPointAssets `json:"light"`
	}

	//nolint:gosec
	f, err := os.Open(filepath.Join(cfg.StaticRootPath, "build", "assets-manifest.json"))
	if err != nil {
		return
	}
	defer func() { _ = f.Close() }()

	var manifest map[string]entryPoints
	if err := json.NewDecoder(f).Decode(&manifest); err != nil {
		return
	}

	ep := manifest["entrypoints"]
	if ep.Dark != nil && len(ep.Dark.Assets.CSS) > 0 {
		dark = ep.Dark.Assets.CSS[0]
	}
	if ep.Light != nil && len(ep.Light.Assets.CSS) > 0 {
		light = ep.Light.Assets.CSS[0]
	}
	return
}

// Handle handles and logs error by given status.
func (ctx *ReqContext) Handle(cfg *setting.Cfg, status int, title string, err error) {
	dark, light := readManifestCSS(cfg)
	if dark == "" {
		dark = cfg.AppSubURL + "/public/build/grafana.dark.css"
	}
	if light == "" {
		light = cfg.AppSubURL + "/public/build/grafana.light.css"
	}

	data := struct {
		Title     string
		AppTitle  string
		AppSubUrl string
		ThemeType string
		ErrorMsg  error
		Assets    *errorPageAssets
	}{title, "Grafana", cfg.AppSubURL, cfg.DefaultTheme, nil, &errorPageAssets{Dark: dark, Light: light}}

	if err != nil {
		ctx.Logger.Error(title, "error", err)
	}

	ctx.HTML(status, cfg.ErrTemplateName, data)
}

func (ctx *ReqContext) IsApiRequest() bool {
	return strings.HasPrefix(ctx.Req.URL.Path, "/api")
}

func (ctx *ReqContext) IsPublicDashboardView() bool {
	return ctx.PublicDashboardAccessToken != ""
}

func (ctx *ReqContext) JsonApiErr(status int, message string, err error) {
	resp := make(map[string]interface{})
	traceID := tracing.TraceIDFromContext(ctx.Req.Context(), false)

	if err != nil {
		resp["traceID"] = traceID
		if status == http.StatusInternalServerError {
			ctx.Logger.Error(message, "error", err, "traceID", traceID)
		} else {
			ctx.Logger.Warn(message, "error", err, "traceID", traceID)
		}
	}

	switch status {
	case http.StatusNotFound:
		resp["message"] = "Not Found"
	case http.StatusInternalServerError:
		resp["message"] = "Internal Server Error"
	}

	if message != "" {
		resp["message"] = message
	}

	ctx.JSON(status, resp)
}

// WriteErr writes an error response based on errutil.Error.
// If provided error is not errutil.Error a 500 response is written.
func (ctx *ReqContext) WriteErr(err error) {
	ctx.writeErrOrFallback(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), err)
}

// WriteErrOrFallback uses the information in an errutil.Error if available
// and otherwise falls back to the status and message provided as arguments.
func (ctx *ReqContext) WriteErrOrFallback(status int, message string, err error) {
	ctx.writeErrOrFallback(status, message, err)
}

func (ctx *ReqContext) writeErrOrFallback(status int, message string, err error) {
	data := make(map[string]interface{})
	statusResponse := status

	traceID := tracing.TraceIDFromContext(ctx.Req.Context(), false)

	if err != nil {
		data["traceID"] = traceID

		var logMessage string
		logger := ctx.Logger.Warn

		gfErr := errutil.Error{}
		if errors.As(err, &gfErr) {
			logger = gfErr.LogLevel.LogFunc(ctx.Logger)
			publicErr := gfErr.Public()

			// need to manually set these fields because we want to include the trace id
			data["extra"] = publicErr.Extra
			data["message"] = publicErr.Message
			data["messageId"] = publicErr.MessageID
			data["statusCode"] = publicErr.StatusCode

			statusResponse = publicErr.StatusCode
		} else {
			if message != "" {
				logMessage = message
			} else {
				logMessage = http.StatusText(status)
				data["message"] = logMessage
			}

			if status == http.StatusInternalServerError {
				logger = ctx.Logger.Error
			}
		}

		if errutil.HasUnifiedLogging(ctx.Req.Context()) {
			ctx.Error = err
		} else {
			logger(logMessage, "error", err, "remote_addr", ctx.RemoteAddr(), "traceID", traceID)
		}
	}

	if _, ok := data["message"]; !ok && message != "" {
		data["message"] = message
	}

	ctx.JSON(statusResponse, data)
}

func (ctx *ReqContext) HasUserRole(role org.RoleType) bool {
	return ctx.SignedInUser.GetOrgRole().Includes(role)
}

func (ctx *ReqContext) HasHelpFlag(flag user.HelpFlags1) bool {
	return ctx.HelpFlags1.HasFlag(flag)
}

func (ctx *ReqContext) TimeRequest(timer prometheus.Summary) {
	ctx.PerfmonTimer = timer
}

// QueryBoolWithDefault extracts a value from the request query params and applies a bool default if not present.
func (ctx *ReqContext) QueryBoolWithDefault(field string, d bool) bool {
	f := ctx.Query(field)
	if f == "" {
		return d
	}

	return ctx.QueryBool(field)
}
