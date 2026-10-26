package meta

import (
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

func callerRequestMetricsFilter(req *restful.Request, resp *restful.Response, chain *restful.FilterChain) {
	ctx := req.Request.Context()
	if info, ok := request.RequestInfoFrom(ctx); ok && info.IsResourceRequest {
		metrics.APIRequestsTotal.WithLabelValues(info.Resource, info.Verb, callerIdentity(ctx)).Inc()
	}
	chain.ProcessFilter(req, resp)
}
