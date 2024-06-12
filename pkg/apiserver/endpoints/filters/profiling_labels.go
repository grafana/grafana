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
		reqInfo, exists := request.RequestInfoFrom(ctx)
		if !exists || reqInfo.Namespace == "" {
			handler.ServeHTTP(w, req)
			return
		}

		info, err := grafanarequest.ParseNamespace(reqInfo.Namespace)
		if err != nil || info.StackID == "" {
			handler.ServeHTTP(w, req)
			return
		}

		pprof.Do(req.Context(), pprof.Labels("stack_id", info.StackID), func(c context.Context) {
			handler.ServeHTTP(w, req.WithContext(c))
		})
	})
}
