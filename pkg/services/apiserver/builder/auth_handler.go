package builder

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"k8s.io/klog/v2"
)

var _ http.Handler = &authHandler{}

type authHandler struct {
	delegateHandler http.Handler
}

func newAuthHandler(delegateHandler http.Handler) http.Handler {
	return &authHandler{
		delegateHandler: delegateHandler,
	}
}

func (h *authHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	signedInUser, err := appcontext.User(ctx)
	if err != nil {
		klog.Error("failed to get signed in user", "err", err)
		h.delegateHandler.ServeHTTP(w, req)
		return
	}

	req.Header.Set("X-Remote-User", strconv.FormatInt(signedInUser.UserID, 10))

	for _, v := range signedInUser.Teams {
		req.Header.Add("X-Remote-Group", strconv.FormatInt(v, 10))
	}

	if signedInUser.IDToken != "" {
		req.Header.Set("X-Remote-Extra-ID-Token", signedInUser.IDToken)
	}
	h.delegateHandler.ServeHTTP(w, req.WithContext(ctx))
}
