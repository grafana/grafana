package api

import (
	"net/http"
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestUserPageRoutes(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.RouteRegister = &userPageRouteRegister{RouteRegister: hs.RouteRegister, t: t, index: hs.Index}
	})
	server.HttpClient.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	for _, page := range []string{"", "/teams", "/roles", "/organizations", "/sessions", "/authentication", "/unknown"} {
		for _, action := range []string{accesscontrol.ActionOrgUsersRead, accesscontrol.ActionUsersRead, ""} {
			t.Run(page+"/"+action, func(t *testing.T) {
				caller := &user.SignedInUser{
					UserID:      1,
					OrgID:       1,
					Permissions: map[int64]map[string][]string{1: {action: {}}},
				}
				res, err := server.Send(webtest.RequestWithSignedInUser(server.NewRequest(http.MethodGet, "/admin/users/edit/alice"+page, nil), caller))
				require.NoError(t, err)
				t.Cleanup(func() { require.NoError(t, res.Body.Close()) })
				if action == "" {
					require.Equal(t, http.StatusFound, res.StatusCode)
					require.Equal(t, "/", res.Header.Get("Location"))
				} else {
					require.Equal(t, http.StatusOK, res.StatusCode)
				}
			})
		}
	}
}

type userPageRouteRegister struct {
	routing.RouteRegister
	t     *testing.T
	index web.Handler
}

func (r *userPageRouteRegister) Get(pattern string, handlers ...web.Handler) {
	if strings.HasPrefix(pattern, "/admin/users/edit/") {
		require.Equal(r.t, reflect.ValueOf(r.index).Pointer(), reflect.ValueOf(handlers[len(handlers)-1]).Pointer())
		// Exercise the registered route and authorization without the unrelated index-rendering dependencies.
		handlers[len(handlers)-1] = func(c *contextmodel.ReqContext) { c.Resp.WriteHeader(http.StatusOK) }
	}
	r.RouteRegister.Get(pattern, handlers...)
}
