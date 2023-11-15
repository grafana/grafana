package grafanaapiserver

import (
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
)

var _ http.Handler = &authHandler{}

type authHandler struct {
	delegateHandler http.Handler
	log             log.Logger
}

func newAuthHandler(delegateHandler http.Handler) http.Handler {
	return &authHandler{
		delegateHandler: delegateHandler,
		log:             log.New("grafanaapiserver.authhandler"),
	}
}

func (h *authHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	ctx, err := utils.ContextWithGrafanaUser(req.Context())
	if err != nil {
		h.log.Error("failed to add grafana user to context", "err", err)
		h.delegateHandler.ServeHTTP(w, req)
		return
	}
	h.delegateHandler.ServeHTTP(w, req.WithContext(ctx))
}
