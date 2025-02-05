package filters

import (
	"net/http"
	"slices"

	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/klog/v2"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// WithRequester makes sure there is an identity.Requester in context
func WithRequester(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ctx := req.Context()
		_, err := identity.GetRequester(ctx)
		if err == nil {
			handler.ServeHTTP(w, req)
			return
		}

		// Find the kubernetes user info
		info, ok := request.UserFrom(ctx)
		if !ok {
			handler.ServeHTTP(w, req)
			return
		}

		if ok && info.GetName() == user.Anonymous {
			req = req.WithContext(identity.WithRequester(ctx, &identity.StaticRequester{
				Type:        claims.TypeAnonymous,
				Name:        info.GetName(),
				Login:       info.GetName(),
				Permissions: map[int64]map[string][]string{},
			}))
		} else if ok && info.GetName() == user.APIServerUser ||
			slices.Contains(info.GetGroups(), user.SystemPrivilegedGroup) {
			// For system:apiserver we use the identity of the service itself
			ctx, _ = identity.WithServiceIdentity(ctx, 1)
			req = req.WithContext(ctx)
		} else {
			klog.V(5).Info("unable to map the k8s user to grafana requester", "user", info)
		}

		handler.ServeHTTP(w, req)
	})
}
