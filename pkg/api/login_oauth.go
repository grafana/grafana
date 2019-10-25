package api

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	oauthLogger          = log.New("oauth")
	OauthStateCookieName = "oauth_state"
)

func GenStateString() (string, error) {
	rnd := make([]byte, 32)
	if _, err := rand.Read(rnd); err != nil {
		oauthLogger.Error("failed to generate state string", "err", err)
		return "", err
	}
	return base64.URLEncoding.EncodeToString(rnd), nil
}

func (hs *HTTPServer) OAuthLogin(ctx *m.ReqContext) {
	if setting.OAuthService == nil {
		ctx.Handle(404, "OAuth not enabled", nil)
		return
	}
}

func (hs *HTTPServer) deleteCookie(w http.ResponseWriter, name string, sameSite http.SameSite) {
	hs.writeCookie(w, name, "", -1, sameSite)
}

func (hs *HTTPServer) writeCookie(w http.ResponseWriter, name string, value string, maxAge int, sameSite http.SameSite) {
	cookie := http.Cookie{
		Name:     name,
		MaxAge:   maxAge,
		Value:    value,
		HttpOnly: true,
		Path:     setting.AppSubUrl + "/",
		Secure:   hs.Cfg.CookieSecure,
	}
	if sameSite != http.SameSiteDefaultMode {
		cookie.SameSite = sameSite
	}
	http.SetCookie(w, &cookie)
}

func hashStatecode(code, seed string) string {
	hashBytes := sha256.Sum256([]byte(code + setting.SecretKey + seed))
	return hex.EncodeToString(hashBytes[:])
}

func (hs *HTTPServer) redirectWithError(ctx *m.ReqContext, err error, v ...interface{}) {
	ctx.Logger.Error(err.Error(), v...)
	if err := hs.trySetEncryptedCookie(ctx, LoginErrorCookieName, err.Error(), 60); err != nil {
		oauthLogger.Error("Failed to set encrypted cookie", "err", err)
	}

	ctx.Redirect(setting.AppSubUrl + "/login")
}
