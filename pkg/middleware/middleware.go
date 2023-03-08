package middleware

import (
	"fmt"
	"strings"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var (
	ReqGrafanaAdmin = Auth(&AuthOptions{
		ReqSignedIn:     true,
		ReqGrafanaAdmin: true,
	})
	ReqSignedIn            = Auth(&AuthOptions{ReqSignedIn: true})
	ReqSignedInNoAnonymous = Auth(&AuthOptions{ReqSignedIn: true, ReqNoAnonynmous: true})
	ReqEditorRole          = RoleAuth(org.RoleEditor, org.RoleAdmin)
	ReqOrgAdmin            = RoleAuth(org.RoleAdmin)
)

func HandleNoCacheHeader(ctx *contextmodel.ReqContext) {
	ctx.SkipCache = ctx.Req.Header.Get("X-Grafana-NoCache") == "true"
}

func AddDefaultResponseHeaders(cfg *setting.Cfg) web.Handler {
	t := web.NewTree()
	t.Add("/api/datasources/uid/:uid/resources/*", nil)
	t.Add("/api/datasources/:id/resources/*", nil)
	return func(c *web.Context) {
		c.Resp.Before(func(w web.ResponseWriter) { // if response has already been written, skip.
			if w.Written() {
				return
			}

			_, _, resourceURLMatch := t.Match(c.Req.URL.Path)
			resourceCachable := resourceURLMatch && allowCacheControl(c.Resp)
			if !strings.HasPrefix(c.Req.URL.Path, "/public/plugins/") &&
				!strings.HasPrefix(c.Req.URL.Path, "/api/datasources/proxy/") && !resourceCachable {
				addNoCacheHeaders(c.Resp)
			}

			if !cfg.AllowEmbedding {
				addXFrameOptionsDenyHeader(w)
			}
			addSecurityHeaders(w, cfg)
		})
	}
}

// addSecurityHeaders adds HTTP(S) response headers that enable various security protections in the client's browser.
func addSecurityHeaders(w web.ResponseWriter, cfg *setting.Cfg) {
	if cfg.StrictTransportSecurity {
		strictHeaderValues := []string{fmt.Sprintf("max-age=%v", cfg.StrictTransportSecurityMaxAge)}
		if cfg.StrictTransportSecurityPreload {
			strictHeaderValues = append(strictHeaderValues, "preload")
		}
		if cfg.StrictTransportSecuritySubDomains {
			strictHeaderValues = append(strictHeaderValues, "includeSubDomains")
		}
		w.Header().Set("Strict-Transport-Security", strings.Join(strictHeaderValues, "; "))
	}

	if cfg.ContentTypeProtectionHeader {
		w.Header().Set("X-Content-Type-Options", "nosniff")
	}

	if cfg.XSSProtectionHeader {
		w.Header().Set("X-XSS-Protection", "1; mode=block")
	}
}

func addNoCacheHeaders(w web.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Del("Pragma")
	w.Header().Del("Expires")
}

func addXFrameOptionsDenyHeader(w web.ResponseWriter) {
	w.Header().Set("X-Frame-Options", "deny")
}

func AddCustomResponseHeaders(cfg *setting.Cfg) web.Handler {
	return func(c *web.Context) {
		c.Resp.Before(func(w web.ResponseWriter) {
			if w.Written() {
				return
			}

			for header, value := range cfg.CustomResponseHeaders {
				// do not override existing headers
				if w.Header().Get(header) != "" {
					continue
				}
				w.Header().Set(header, value)
			}
		})
	}
}

func allowCacheControl(rw web.ResponseWriter) bool {
	ccHeaderValues := rw.Header().Values("Cache-Control")

	if len(ccHeaderValues) == 0 {
		return false
	}

	foundPrivate := false
	foundPublic := false
	for _, val := range ccHeaderValues {
		strings.Contains(val, "private")
		if strings.Contains(val, "private") {
			foundPrivate = true
		}
		if strings.Contains(val, "public") {
			foundPublic = true
		}
	}

	return foundPrivate && !foundPublic && rw.Header().Get("X-Grafana-Cache") != ""
}
