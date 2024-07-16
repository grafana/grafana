package api

import (
	"errors"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/services/authn"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

const (
	OauthStateCookieName = "oauth_state"
	OauthPKCECookieName  = "oauth_code_verifier"
)

func (hs *HTTPServer) OAuthLogin(reqCtx *contextmodel.ReqContext) {
	name := web.Params(reqCtx.Req)[":name"]

	if errorParam := reqCtx.Query("error"); errorParam != "" {
		errorDesc := reqCtx.Query("error_description")
		hs.log.Error("failed to login ", "error", errorParam, "errorDesc", errorDesc)

		hs.redirectWithError(reqCtx, errors.New("login provider denied login request"), "error", errorParam, "errorDesc", errorDesc)
		return
	}

	query := reqCtx.Req.URL.Query()
	req := &authn.Request{HTTPRequest: reqCtx.Req}

	// Handle initiate login.
	if query.Has("initiate") {
		redirect, err := hs.authnService.RedirectURL(reqCtx.Req.Context(), authn.ClientWithPrefix(name), req)
		if err != nil {
			reqCtx.Redirect(hs.redirectURLWithErrorCookie(reqCtx, err))
			return
		}

		cookies.WriteCookie(reqCtx.Resp, OauthStateCookieName, redirect.Extra[authn.KeyOAuthState], hs.Cfg.OAuthCookieMaxAge, hs.CookieOptionsFromCfg)

		if pkce := redirect.Extra[authn.KeyOAuthPKCE]; pkce != "" {
			cookies.WriteCookie(reqCtx.Resp, OauthPKCECookieName, pkce, hs.Cfg.OAuthCookieMaxAge, hs.CookieOptionsFromCfg)
		}

		reqCtx.Redirect(redirect.URL)
		return
	}

	// Handle implicit callback, or old (cached?) initiate URL without "?initiate".
	if !query.Has("code") && !query.Has("access_token") {
		resp := reqCtx.Resp
		resp.Header().Add("Content-Type", "text/html")
		resp.Write([]byte(`<html>
			<body>
				<script>
					var hash_query = document.location.hash.slice(1);
					var params = new URLSearchParams(hash_query);
					var is_implicit_callback = params.has("access_token") || params.has("error");
					document.location.replace(document.location.origin + document.location.pathname + (
						is_implicit_callback
							? ("?" + hash_query)
							: "?initiate"
					));
				</script>
			</body>
		</html>`))
		return
	}

	// Handle implicit callback 2nd stage (if "access_token" presents) or access code flow (if "code" presents).

	identity, err := hs.authnService.Login(reqCtx.Req.Context(), authn.ClientWithPrefix(name), req)
	// NOTE: always delete these cookies, even if login failed
	cookies.DeleteCookie(reqCtx.Resp, OauthStateCookieName, hs.CookieOptionsFromCfg)
	cookies.DeleteCookie(reqCtx.Resp, OauthPKCECookieName, hs.CookieOptionsFromCfg)

	if err != nil {
		reqCtx.Redirect(hs.redirectURLWithErrorCookie(reqCtx, err))
		return
	}

	metrics.MApiLoginOAuth.Inc()
	authn.HandleLoginRedirect(reqCtx.Req, reqCtx.Resp, hs.Cfg, identity, hs.ValidateRedirectTo)
}
