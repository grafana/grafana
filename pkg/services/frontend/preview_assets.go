package frontend

import (
	"crypto/rand"
	"crypto/subtle"
	"embed"
	"encoding/hex"
	"html/template"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	fswebassets "github.com/grafana/grafana/pkg/services/frontend/webassets"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	previewAssetsPath = "/-/set-preview-assets"

	// Stores only the folder name; asset URLs are always built server-side.
	previewAssetsCookieName = "grafana_preview_assets"
	previewCSRFCookieName   = "grafana_preview_assets_csrf"

	csrfTokenLength     = 32
	csrfCookieMaxAge    = 10 * time.Minute
	previewCookieMaxAge = 24 * time.Hour
)

var (
	//go:embed preview_assets_confirm.html
	previewAssetsTemplateFS embed.FS

	// Parsed with the default {{ }} delimiters; kept separate from the index
	// template set which uses [[ ]].
	previewAssetsConfirmTemplate = template.Must(template.ParseFS(previewAssetsTemplateFS, "preview_assets_confirm.html"))
)

type previewAssetsHandler struct {
	previewCfg   fswebassets.PreviewAssetsConfig
	cookieSecure bool
}

func newPreviewAssetsHandler(cfg *setting.Cfg, previewCfg fswebassets.PreviewAssetsConfig) *previewAssetsHandler {
	return &previewAssetsHandler{
		previewCfg:   previewCfg,
		cookieSecure: cfg.CookieSecure,
	}
}

// handleGet serves the whole opt-in flow. The frontend service only receives
// GETs, so the confirm step is a CSRF-token-guarded GET rather than a POST.
func (h *previewAssetsHandler) handleGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	logger := contexthandler.FromContext(ctx).Logger

	query := r.URL.Query()

	if query.Get("clear") != "" {
		h.setCookie(w, previewAssetsCookieName, "", -1)
		logger.Info("preview assets cookie cleared")
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}

	folder := query.Get("assets")
	if folder == "" {
		http.Error(w, "missing 'assets' query parameter", http.StatusBadRequest)
		return
	}

	assetsURL, err := fswebassets.ResolvePreviewAssetsURL(h.previewCfg.BaseURL, folder)
	if err != nil {
		logger.Warn("rejected preview assets folder", "folder", folder, "reason", err)
		http.Error(w, "invalid 'assets' query parameter", http.StatusBadRequest)
		return
	}

	confirmToken := query.Get("confirm")
	if confirmToken == "" {
		h.renderConfirmationPage(w, logger, folder, assetsURL)
		return
	}

	csrfCookie, err := r.Cookie(previewCSRFCookieName)
	if err != nil || csrfCookie.Value == "" {
		http.Error(w, "missing or expired confirmation token, go back and try again", http.StatusForbidden)
		return
	}
	if subtle.ConstantTimeCompare([]byte(csrfCookie.Value), []byte(confirmToken)) != 1 {
		logger.Warn("preview assets confirmation token mismatch", "folder", folder)
		http.Error(w, "invalid confirmation token, go back and try again", http.StatusForbidden)
		return
	}

	// Check the preview build actually exists before committing the browser to
	// it for 24 hours.
	if _, err := fswebassets.GetPreviewWebAssets(ctx, h.previewCfg, folder); err != nil {
		logger.Warn("preview assets manifest could not be loaded", "folder", folder, "err", err)
		http.Error(w, "preview assets could not be loaded - check the deploy exists and has finished uploading", http.StatusBadGateway)
		return
	}

	h.clearCSRFCookie(w)
	h.setCookie(w, previewAssetsCookieName, folder, int(previewCookieMaxAge.Seconds()))

	logger.Info("preview assets cookie set", "folder", folder, "url", assetsURL)

	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (h *previewAssetsHandler) renderConfirmationPage(w http.ResponseWriter, logger log.Logger, folder, assetsURL string) {
	csrfToken, err := generateCSRFToken()
	if err != nil {
		logger.Error("failed to generate CSRF token", "err", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Secure follows [security] cookie_secure, like all Grafana cookies (see pkg/middleware/cookies).
	// #nosec G124 nosemgrep: go.lang.security.audit.net.cookie-missing-secure.cookie-missing-secure
	http.SetCookie(w, &http.Cookie{
		Name:     previewCSRFCookieName,
		Value:    csrfToken,
		Path:     previewAssetsPath,
		MaxAge:   int(csrfCookieMaxAge.Seconds()),
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteStrictMode,
	})

	w.Header().Set("Content-Type", "text/html; charset=UTF-8")
	w.Header().Set("Cache-Control", "no-store")
	// The confirmation token travels in the query string; keep it out of Referer.
	w.Header().Set("Referrer-Policy", "no-referrer")

	err = previewAssetsConfirmTemplate.Execute(w, struct {
		Folder    string
		AssetsURL string
		CSRFToken string
		Duration  string
	}{
		Folder:    folder,
		AssetsURL: assetsURL,
		CSRFToken: csrfToken,
		Duration:  "24 hours",
	})
	if err != nil {
		logger.Error("failed to render preview assets confirmation page", "err", err)
	}
}

func (h *previewAssetsHandler) clearCSRFCookie(w http.ResponseWriter) {
	// Secure follows [security] cookie_secure, like all Grafana cookies (see pkg/middleware/cookies).
	// #nosec G124 nosemgrep: go.lang.security.audit.net.cookie-missing-secure.cookie-missing-secure
	http.SetCookie(w, &http.Cookie{
		Name:     previewCSRFCookieName,
		Value:    "",
		Path:     previewAssetsPath,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteStrictMode,
	})
}

func (h *previewAssetsHandler) setCookie(w http.ResponseWriter, name, value string, maxAge int) {
	// Secure follows [security] cookie_secure, like all Grafana cookies (see pkg/middleware/cookies).
	// #nosec G124 nosemgrep: go.lang.security.audit.net.cookie-missing-secure.cookie-missing-secure
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func generateCSRFToken() (string, error) {
	bytes := make([]byte, csrfTokenLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
