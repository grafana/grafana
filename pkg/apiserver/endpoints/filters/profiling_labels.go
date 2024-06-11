package filters

import (
	"context"
	"net/http"
	"runtime/pprof"

	"k8s.io/apiserver/pkg/endpoints/request"

	grafanarequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

func WithProfilingLabels(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ctx := req.Context()
		namespace := request.NamespaceValue(ctx)
		info, err := grafanarequest.ParseNamespace(namespace)
		if err != nil || info.StackID == "" {
			handler.ServeHTTP(w, req)
			return
		}

		pprof.Do(req.Context(), pprof.Labels("stack_id", info.StackID), func(c context.Context) {
			handler.ServeHTTP(w, req.WithContext(c))
		})
	})
}
