package datasource

import (
	"context"
	"net/http"
	"time"

	krequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
)

var proxyUsageLogger = log.New("datasource.proxy.usage")

func logProxyUsage(ctx context.Context, req *http.Request, uid, pluginID string, status int, elapsed time.Duration) {
	fields := []any{
		"namespace", krequest.NamespaceValue(ctx),
		"datasource_uid", uid,
		"datasource_type", pluginID,
		"path", req.URL.EscapedPath(),
		"proxy_path", proxyPathFromRequest(req, uid),
		"method", req.Method,
		"status", status,
		"duration_ms", elapsed.Milliseconds(),
		"remote_addr", req.RemoteAddr,
		// These client-supplied fields help correlate dashboard activity; they are not identity evidence.
		"client_dashboard_uid", req.Header.Get("X-Dashboard-Uid"),
		"client_dashboard_id", req.Header.Get("X-Dashboard-Id"),
		"client_panel_id", req.Header.Get("X-Panel-Id"),
		"client_panel_plugin_id", req.Header.Get("X-Panel-Plugin-Id"),
	}
	if requester, err := identity.GetRequester(ctx); err == nil {
		fields = append(fields,
			"requester_uid", requester.GetUID(),
			"requester_type", requester.GetIdentityType(),
			"requester_login", requester.GetLogin(),
			"org_id", requester.GetOrgID(),
		)
	}
	// Keep usage logging independent of dataproxy.logging, which captures request bodies.
	proxyUsageLogger.FromContext(ctx).Info("Datasource proxy request completed", fields...)
}
