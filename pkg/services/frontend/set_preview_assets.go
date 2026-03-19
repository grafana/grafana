package frontend

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"fmt"
	"html/template"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/services/contexthandler"
	fswebassets "github.com/grafana/grafana/pkg/services/frontend/webassets"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	assetsOverrideCookieName = "grafana_assets_override"
	csrfCookieName           = "grafana_assets_csrf"
	csrfTokenLength          = 32
	cookieMaxAge             = 24 * time.Hour
)

var (
	//go:embed set_preview_assets_confirm.html
	previewAssetsTemplatesFS embed.FS

	confirmationPageTemplate = template.Must(template.ParseFS(previewAssetsTemplatesFS, "set_preview_assets_confirm.html"))
)

// AssetsOverrideConfig holds the configuration for the frontend preview assets feature.
// It is loaded directly from the ini config in the frontend service, not from setting.Cfg.
type AssetsOverrideConfig struct {
	// Enabled controls whether asset base URL overrides are allowed.
	Enabled bool

	// BaseURL is the base URL under which preview asset builds are stored.
	// An asset ID is appended to this URL to form the full override URL.
	// For example, if this is "https://storage.googleapis.com/bucket/" and the ID is "pr_grafana_123_my-branch",
	// the full URL becomes "https://storage.googleapis.com/bucket/pr_grafana_123_my-branch/".
	BaseURL string
}

// ReadAssetsOverrideConfig reads the preview assets configuration from the ini config file.
func ReadAssetsOverrideConfig(cfg *setting.Cfg) AssetsOverrideConfig {
	server := cfg.Raw.Section("server")
	return AssetsOverrideConfig{
		Enabled: server.Key("assets_base_override_enabled").MustBool(false),
		BaseURL: server.Key("assets_base_override_base_url").String(),
	}
}

type assetsOverrideHandler struct {
	previewCfg   AssetsOverrideConfig
	cookieSecure bool
}

func newAssetsOverrideHandler(cfg *setting.Cfg, previewCfg AssetsOverrideConfig) *assetsOverrideHandler {
	return &assetsOverrideHandler{
		previewCfg:   previewCfg,
		cookieSecure: cfg.CookieSecure,
	}
}

func (h *assetsOverrideHandler) handleGet(w http.ResponseWriter, request *http.Request) {
	ctx := request.Context()
	reqCtx := contexthandler.FromContext(ctx)
	assetsID := request.URL.Query().Get("assets")
	if assetsID == "" {
		http.Error(w, "missing 'assets' query parameter", http.StatusBadRequest)
		return
	}

	assetsURL, err := fswebassets.ResolveAssetsOverrideURL(h.previewCfg.BaseURL, assetsID)
	if err != nil {
		reqCtx.Logger.Warn("rejected preview assets ID", "id", assetsID, "reason", err)
		http.Error(w, fmt.Sprintf("invalid assets ID: %s", err), http.StatusBadRequest)
		return
	}

	// Generate CSRF token and set it as a cookie
	csrfToken, err := generateCSRFToken()
	if err != nil {
		reqCtx.Logger.Error("failed to generate CSRF token", "error", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     csrfCookieName,
		Value:    csrfToken,
		Path:     "/-/set-preview-assets",
		MaxAge:   600, // 10 minutes to complete the confirmation
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteStrictMode,
	})

	w.Header().Set("Content-Type", "text/html; charset=UTF-8")
	w.Header().Set("Cache-Control", "no-store")
	if err := confirmationPageTemplate.Execute(w, struct {
		AssetsID  string
		AssetsURL string
		CSRFToken string
	}{
		AssetsID:  assetsID,
		AssetsURL: assetsURL,
		CSRFToken: csrfToken,
	}); err != nil {
		reqCtx.Logger.Error("failed to render confirmation page", "error", err)
	}
}

func (h *assetsOverrideHandler) handlePost(writer http.ResponseWriter, request *http.Request) {
	ctx := request.Context()
	reqCtx := contexthandler.FromContext(ctx)

	if err := request.ParseForm(); err != nil {
		http.Error(writer, "invalid form data", http.StatusBadRequest)
		return
	}

	assetsID := request.FormValue("assets")
	formCSRFToken := request.FormValue("csrf_token")

	if assetsID == "" || formCSRFToken == "" {
		http.Error(writer, "missing required fields", http.StatusBadRequest)
		return
	}

	// Validate CSRF: compare form token against the cookie token
	csrfCookie, err := request.Cookie(csrfCookieName)
	if err != nil || csrfCookie.Value == "" {
		http.Error(writer, "missing or expired CSRF token — please try again", http.StatusForbidden)
		return
	}

	if formCSRFToken != csrfCookie.Value {
		http.Error(writer, "CSRF token mismatch", http.StatusForbidden)
		return
	}

	assetsURL, err := fswebassets.ResolveAssetsOverrideURL(h.previewCfg.BaseURL, assetsID)
	if err != nil {
		reqCtx.Logger.Warn("rejected preview assets ID on POST", "id", assetsID, "reason", err)
		http.Error(writer, fmt.Sprintf("invalid assets ID: %s", err), http.StatusBadRequest)
		return
	}

	// Clear the CSRF cookie
	http.SetCookie(writer, &http.Cookie{
		Name:     csrfCookieName,
		Value:    "",
		Path:     "/-/set-preview-assets",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteStrictMode,
	})

	// Set the assets override cookie — stores only the ID, not the full URL
	http.SetCookie(writer, &http.Cookie{
		Name:     assetsOverrideCookieName,
		Value:    assetsID,
		Path:     "/",
		MaxAge:   int(cookieMaxAge.Seconds()),
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})

	reqCtx.Logger.Info("preview assets cookie set", "id", assetsID, "url", assetsURL)

	http.Redirect(writer, request, "/", http.StatusSeeOther)
}

func generateCSRFToken() (string, error) {
	bytes := make([]byte, csrfTokenLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
