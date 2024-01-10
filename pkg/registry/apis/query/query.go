package query

import (
	"net/http"

	"k8s.io/apiserver/pkg/endpoints/request"
)

func (b *QueryAPIBuilder) handleQuery(w http.ResponseWriter, r *http.Request) {
	info, ok := request.RequestInfoFrom(r.Context())
	if !ok {
		_, _ = w.Write([]byte("missing namespace"))
		return
	}

	_, _ = w.Write([]byte("Custom namespace route ccc: " + info.Namespace))
}
