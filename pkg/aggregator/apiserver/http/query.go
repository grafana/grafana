package http

import (
	"net/http"

	aggregationv0alpha1 "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
)

func (h *HTTPHandler) QueryDataHandler(b aggregationv0alpha1.Backend) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("QueryDataHandler not implemented"))
	})
}
