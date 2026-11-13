package meta

import (
	"context"

	"github.com/emicklei/go-restful/v3"
	"k8s.io/apiserver/pkg/endpoints/request"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
)

// AddCallerRequestMetrics counts every request to the plugins API group version by caller.
// It is a web service filter, so it sees all verbs on all resources without wrapping storage.
func AddCallerRequestMetrics(services []*restful.WebService) {
	rootPath := "/apis/" + pluginsv0alpha1.APIGroup + "/" + pluginsv0alpha1.APIVersion
	for _, ws := range services {
		if ws.RootPath() == rootPath {
			ws.Filter(callerRequestMetricsFilter)
		}
	}
}

type userAgentKey struct{}

// CallerLogArgs returns the log key/values that identify who made the request: the immediate
// service identity, the originating (innermost) service identity and the User-Agent.
// User-Agent is self-declared, so treat it as a debugging hint, not an identity.
// It is deliberately a log field only, never a metric label (unbounded cardinality).
func CallerLogArgs(ctx context.Context) []any {
	ua, _ := ctx.Value(userAgentKey{}).(string)
	return []any{"caller", callerIdentity(ctx), "originCaller", OriginCallerIdentity(ctx), "userAgent", ua}
}

func callerRequestMetricsFilter(req *restful.Request, resp *restful.Response, chain *restful.FilterChain) {
	ctx := context.WithValue(req.Request.Context(), userAgentKey{}, req.Request.UserAgent())
	req.Request = req.Request.WithContext(ctx)
	if info, ok := request.RequestInfoFrom(ctx); ok && info.IsResourceRequest {
		metrics.APIRequestsTotal.WithLabelValues(info.Resource, info.Verb, callerIdentity(ctx)).Inc()
	}
	chain.ProcessFilter(req, resp)
}
