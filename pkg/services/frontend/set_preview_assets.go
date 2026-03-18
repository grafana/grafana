package frontend

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"fmt"
	"html/template"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	assetsOverrideCookieName = "grafana_assets_override"
	csrfCookieName           = "grafana_assets_csrf"
	csrfTokenLength          = 32
	cookieMaxAge             = 24 * time.Hour
)

// validAssetsID matches alphanumeric characters and underscores only.
var validAssetsID = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

var (
	//go:embed set_preview_assets_confirm.html
	previewAssetsTemplatesFS embed.FS

	confirmationPageTemplate = template.Must(template.ParseFS(previewAssetsTemplatesFS, "set_preview_assets_confirm.html"))
)

// PreviewAssetsConfig holds the configuration for the frontend preview assets feature.
// It is loaded directly from the ini config in the frontend service, not from setting.Cfg.
type PreviewAssetsConfig struct {
	// Enabled controls whether asset base URL overrides are allowed.
	Enabled bool

	// BaseURL is the base URL under which preview asset builds are stored.
	// An asset ID is appended to this URL to form the full override URL.
	// For example, if this is "https://storage.googleapis.com/bucket/" and the ID is "pr_grafana_123_my-branch",
	// the full URL becomes "https://storage.googleapis.com/bucket/pr_grafana_123_my-branch/".
	BaseURL string
}

// ReadPreviewAssetsConfig reads the preview assets configuration from the ini config file.
func ReadPreviewAssetsConfig(cfg *setting.Cfg) PreviewAssetsConfig {
	server := cfg.Raw.Section("server")
	return PreviewAssetsConfig{
		Enabled: server.Key("assets_base_override_enabled").MustBool(false),
		BaseURL: server.Key("assets_base_override_base_url").String(),
	}
}

type previewAssetsHandler struct {
	previewCfg   PreviewAssetsConfig
	cookieSecure bool
	log          log.Logger
}

func newPreviewAssetsHandler(cfg *setting.Cfg, previewCfg PreviewAssetsConfig) *previewAssetsHandler {
	return &previewAssetsHandler{
		previewCfg:   previewCfg,
		cookieSecure: cfg.CookieSecure,
		log:          log.New("frontend.preview-assets"),
	}
}

// resolveAssetsURL constructs the full override URL from the configured base URL and an asset ID.
func (h *previewAssetsHandler) resolveAssetsURL(assetsID string) string {
	base := h.previewCfg.BaseURL
	if !strings.HasSuffix(base, "/") {
		base += "/"
	}
	return base + assetsID + "/"
}

func (h *previewAssetsHandler) handleGet(w http.ResponseWriter, r *http.Request) {
	assetsID := r.URL.Query().Get("assets")
	if assetsID == "" {
		http.Error(w, "missing 'assets' query parameter", http.StatusBadRequest)
		return
	}

	if err := h.validateAssetsID(assetsID); err != nil {
		h.log.Warn("rejected preview assets ID", "id", assetsID, "reason", err)
		http.Error(w, fmt.Sprintf("invalid assets ID: %s", err), http.StatusBadRequest)
		return
	}

	// Generate CSRF token and set it as a cookie
	csrfToken, err := generateCSRFToken()
	if err != nil {
		h.log.Error("failed to generate CSRF token", "error", err)
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
		AssetsURL: h.resolveAssetsURL(assetsID),
		CSRFToken: csrfToken,
	}); err != nil {
		h.log.Error("failed to render confirmation page", "error", err)
	}
}

func (h *previewAssetsHandler) handlePost(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	assetsID := r.FormValue("assets")
	formCSRFToken := r.FormValue("csrf_token")

	if assetsID == "" || formCSRFToken == "" {
		http.Error(w, "missing required fields", http.StatusBadRequest)
		return
	}

	// Validate CSRF: compare form token against the cookie token
	csrfCookie, err := r.Cookie(csrfCookieName)
	if err != nil || csrfCookie.Value == "" {
		http.Error(w, "missing or expired CSRF token — please try again", http.StatusForbidden)
		return
	}

	if formCSRFToken != csrfCookie.Value {
		http.Error(w, "CSRF token mismatch", http.StatusForbidden)
		return
	}

	if err := h.validateAssetsID(assetsID); err != nil {
		h.log.Warn("rejected preview assets ID on POST", "id", assetsID, "reason", err)
		http.Error(w, fmt.Sprintf("invalid assets ID: %s", err), http.StatusBadRequest)
		return
	}

	// Clear the CSRF cookie
	http.SetCookie(w, &http.Cookie{
		Name:     csrfCookieName,
		Value:    "",
		Path:     "/-/set-preview-assets",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteStrictMode,
	})

	// Set the assets override cookie — stores only the ID, not the full URL
	http.SetCookie(w, &http.Cookie{
		Name:     assetsOverrideCookieName,
		Value:    assetsID,
		Path:     "/",
		MaxAge:   int(cookieMaxAge.Seconds()),
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})

	h.log.Info("preview assets cookie set", "id", assetsID, "url", h.resolveAssetsURL(assetsID))

	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (h *previewAssetsHandler) validateAssetsID(assetsID string) error {
	if !h.previewCfg.Enabled {
		return fmt.Errorf("assets base override is not enabled")
	}

	if h.previewCfg.BaseURL == "" {
		return fmt.Errorf("assets base override base URL is not configured")
	}

	if len(assetsID) > 256 {
		return fmt.Errorf("assets ID exceeds maximum length")
	}

	if !validAssetsID.MatchString(assetsID) {
		return fmt.Errorf("assets ID contains invalid characters")
	}

	// Reject path traversal
	if strings.Contains(assetsID, "..") {
		return fmt.Errorf("assets ID contains path traversal")
	}

	return nil
}

func generateCSRFToken() (string, error) {
	bytes := make([]byte, csrfTokenLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
