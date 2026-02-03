package middleware

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// AltSvcHeader adds the Alt-Svc header to responses when HTTP/3 is enabled.
// This header tells browsers that HTTP/3 is available on the specified port.
// Browsers will automatically upgrade to HTTP/3 on subsequent requests.
// See RFC 7838 for more information on Alt-Svc.
func AltSvcHeader(cfg *setting.Cfg, features featuremgmt.FeatureToggles) web.Handler {
	// Check if HTTP/3 is enabled via both config and feature flag
	http3Enabled := cfg.HTTP3Enabled && features.IsEnabledGlobally(featuremgmt.FlagHttp3Server)
	if !http3Enabled {
		return func(c *web.Context) {}
	}

	// Format: h3=":port"; ma=max-age
	// ma=86400 means the Alt-Svc information is valid for 24 hours
	altSvcValue := fmt.Sprintf(`h3=":%s"; ma=86400`, cfg.HTTP3Port)

	return func(c *web.Context) {
		c.Resp.Before(func(w web.ResponseWriter) {
			if w.Written() {
				return
			}
			w.Header().Set("Alt-Svc", altSvcValue)
		})
	}
}
