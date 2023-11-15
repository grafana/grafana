package grafanaapiserver

import (
	"net/http"

	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/roletype"
	grafanaUser "github.com/grafana/grafana/pkg/services/user"
)

var _ http.Handler = &authHandler{}

type authHandler struct {
	delegateHandler http.Handler
	log             log.Logger
}

// This will wrap the handler so you can always get a user from: appcontext.User(ctx)
// Note, users with the `system:masters` or `system:apiserver` groups will become grafana admin users
func newAuthHandler(delegateHandler http.Handler) http.Handler {
	return &authHandler{
		delegateHandler: delegateHandler,
		log:             log.New("grafanaapiserver.authhandler"),
	}
}

func (h *authHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()

	// Find the grafana user
	u, err := appcontext.User(ctx)
	if u != nil && err == nil {
		// User already attached, so just use it
		h.delegateHandler.ServeHTTP(w, req)
		return
	}

	// Find the kubernetes user info
	info, ok := request.UserFrom(ctx)
	if ok {
	out: // Check for elevated k8s groups
		for _, group := range info.GetGroups() {
			switch group {
			case user.APIServerUser:
				fallthrough
			case user.SystemPrivilegedGroup:
				u = &grafanaUser.SignedInUser{
					UserID:         1,
					OrgID:          1,
					Name:           info.GetName(),
					Login:          info.GetName(),
					OrgRole:        roletype.RoleAdmin,
					IsGrafanaAdmin: true,
				}
				break out
			case user.Anonymous:
				// u = &grafanaUser.SignedInUser{
				// 	UserID:      -1, // ??
				// 	OrgID:       -1, // ??
				// 	Name:        "anon",
				// 	Login:       "anon",
				// 	OrgRole:     roletype.RoleViewer,
				// 	IsAnonymous: true,
				// }
			}
		}
		// Attach the user to the rest of the request
		if u != nil {
			ctx = appcontext.WithUser(ctx, u)
			h.delegateHandler.ServeHTTP(w, req.WithContext(ctx))
			return
		}
	}

	h.log.Error("unable to attach a grafana user to the the kubernetes API")
	h.delegateHandler.ServeHTTP(w, req)
}
