package filters

import (
	"net/http"
	"slices"

	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/klog/v2"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// WithRequester makes sure there is an identity.Requester in context
func WithRequester(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ctx := req.Context()
		requester, err := identity.GetRequester(ctx)
		if err == nil {
			handler.ServeHTTP(w, req)
			return
		}

		// Find the kubernetes user info
		info, ok := request.UserFrom(ctx)
		if ok {
			if info.GetName() == user.Anonymous {
				requester = &identity.StaticRequester{
					Type:        claims.TypeAnonymous,
					Name:        info.GetName(),
					Login:       info.GetName(),
					Permissions: map[int64]map[string][]string{},
				}
			}

			if info.GetName() == user.APIServerUser ||
				slices.Contains(info.GetGroups(), user.SystemPrivilegedGroup) {
				orgId := int64(1)
				requester = &identity.StaticRequester{
					Type:    claims.TypeServiceAccount, // system:apiserver
					UserID:  1,
					OrgID:   orgId,
					Name:    info.GetName(),
					Login:   info.GetName(),
					OrgRole: identity.RoleAdmin,

					IsGrafanaAdmin: true,
					Namespace:      "default",

					Permissions: map[int64]map[string][]string{
						orgId: {
							"*": {"*"}, // all resources, all scopes
							// FIXME(kalleep): We don't support wildcard actions so we need to list all possible actions
							// for this user. This is not scalable and we should look into how to fix this.
							"org.users:read": {"*"},
							// Dashboards do not support wildcard action
							// dashboards.ActionDashboardsRead:   {"*"},
							// dashboards.ActionDashboardsCreate: {"*"},
							// dashboards.ActionDashboardsWrite:  {"*"},
							// dashboards.ActionDashboardsDelete: {"*"},
							// dashboards.ActionFoldersCreate:    {"*"},
							// dashboards.ActionFoldersRead:      {dashboards.ScopeFoldersAll}, // access to read all folders
						},
					},
				}
			}

			if requester != nil {
				req = req.WithContext(identity.WithRequester(ctx, requester))
			} else {
				klog.V(5).Info("unable to map the k8s user to grafana requester", "user", info)
			}
		}
		handler.ServeHTTP(w, req)
	})
}
