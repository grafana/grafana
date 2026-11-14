package resourcepermissions

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestNewRequiresStartupDependencies(t *testing.T) {
	for _, missing := range []string{"router", "access control service"} {
		t.Run(missing, func(t *testing.T) {
			var router routing.RouteRegister = routing.NewRouteRegister()
			var service accesscontrol.Service = &actest.FakeService{}
			if missing == "router" {
				router = nil
			} else {
				service = nil
			}
			_, err := New(setting.NewCfg(), Options{}, featuremgmt.WithFeatures(), router, nil,
				actest.FakeAccessControl{}, service, nil, nil, nil, nil, NewActionSetService(), iam.Features{})
			require.ErrorContains(t, err, "use NewInternal")
		})
	}
}

func TestNewRegistersRoutesAndFixedRoles(t *testing.T) {
	for _, failRegistration := range []bool{false, true} {
		t.Run(map[bool]string{false: "success", true: "role registration failure"}[failRegistration], func(t *testing.T) {
			router := routing.NewRouteRegister()
			roles := &roleRegistrationRecorder{}
			if failRegistration {
				roles.err = errors.New("role registration failed")
			}
			options := Options{Resource: "teams", Assignments: Assignments{Users: true}}
			_, err := New(setting.NewCfg(), options, featuremgmt.WithFeatures(), router, nil,
				actest.FakeAccessControl{}, roles, sqlstore.NewTestStore(t, sqlstore.WithoutMigrator()),
				nil, nil, nil, NewActionSetService(), iam.Features{})
			require.ErrorIs(t, err, roles.err)
			require.Equal(t, FixedRoleRegistrations(options), roles.roles)
			routes := &routeRecorder{}
			router.Register(routes)
			if failRegistration {
				require.Empty(t, routes.paths)
			} else {
				require.Contains(t, routes.paths, "POST /api/access-control/teams/:resourceID/users/:userID")
				require.Contains(t, routes.paths, "GET /api/access-control/teams/:resourceID")
			}
		})
	}
}

type roleRegistrationRecorder struct {
	actest.FakeService
	roles []accesscontrol.RoleRegistration
	err   error
}

func (r *roleRegistrationRecorder) DeclareFixedRoles(roles ...accesscontrol.RoleRegistration) error {
	r.roles = append(r.roles, roles...)
	return r.err
}

type routeRecorder struct {
	paths []string
}

func (r *routeRecorder) Handle(method, path string, _ []web.Handler) {
	r.paths = append(r.paths, method+" "+path)
}

func (r *routeRecorder) Get(path string, handlers ...web.Handler) {
	r.Handle("GET", path, handlers)
}
