package api

import (
	"context"
	"errors"
	"net/http"
	"net/mail"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"go.opentelemetry.io/otel/trace"
)

func (hs *HTTPServer) GetRedirectURL(c *contextmodel.ReqContext) string {
	redirectURL := hs.Cfg.AppSubURL + "/"
	if redirectTo := c.GetCookie("redirect_to"); len(redirectTo) > 0 {
		if sanitized, err := hs.ValidateRedirectTo(redirectTo); err == nil {
			redirectURL = sanitized
		} else {
			hs.log.FromContext(c.Req.Context()).Debug("Ignored invalid redirect_to cookie value", "redirect_to", redirectTo)
		}
		cookies.DeleteCookie(c.Resp, "redirect_to", hs.CookieOptionsFromCfg)
	}
	return redirectURL
}

func (hs *HTTPServer) errOnExternalUser(ctx context.Context, userID int64) response.Response {
	isExternal, err := hs.isExternalUser(ctx, userID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to validate User", err)
	}
	if isExternal {
		return response.Error(http.StatusForbidden, "Cannot update external User", nil)
	}
	return nil
}

func (hs *HTTPServer) isExternalUser(ctx context.Context, userID int64) (bool, error) {
	info, err := hs.authInfoService.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: userID})

	if errors.Is(err, user.ErrUserNotFound) {
		return false, nil
	}

	if err != nil {
		return true, err
	}

	return hs.isProviderEnabled(hs.Cfg, info.AuthModule), nil
}

func ValidateAndNormalizeEmail(email string) (string, error) {
	if email == "" {
		return "", nil
	}

	e, err := mail.ParseAddress(email)
	if err != nil {
		return "", err
	}

	return e.Address, nil
}

func (hs *HTTPServer) injectSpan(c *contextmodel.ReqContext, name string) (*contextmodel.ReqContext, trace.Span) {
	ctx, span := hs.tracer.Start(c.Req.Context(), name)
	c.Req = c.Req.WithContext(ctx)
	return c, span
}

// scopedSpan wraps a trace.Span so that ending it also restores the request
// context that injectSpanScoped temporarily replaced on the ReqContext.
type scopedSpan struct {
	trace.Span
	c       *contextmodel.ReqContext
	prevReq *http.Request
}

// End ends the underlying span and restores the previous request context. The
// variadic options are forwarded so callers retain the full trace.Span API.
func (s scopedSpan) End(options ...trace.SpanEndOption) {
	s.Span.End(options...)
	s.c.Req = s.prevReq
}

// injectSpanScoped starts a child span named `name` and scopes c's request
// context to it, so that work done by callees that read c.Req.Context()
// (database queries, access-control evaluations, etc.) is grouped under the
// span in traces. The returned span behaves like a normal trace.Span — callers
// can set attributes, record errors, etc. — but ending it also restores the
// previous request context. Callers must end it — via defer to scope a whole
// function, or explicitly to close a single step. Restoring the context keeps
// sibling steps as siblings rather than nesting them under a span that has
// already ended, which is what makes these traces readable.
func (hs *HTTPServer) injectSpanScoped(c *contextmodel.ReqContext, name string) (*contextmodel.ReqContext, trace.Span) {
	prevReq := c.Req
	ctx, span := hs.tracer.Start(c.Req.Context(), name)
	c.Req = c.Req.WithContext(ctx)
	return c, scopedSpan{Span: span, c: c, prevReq: prevReq}
}
