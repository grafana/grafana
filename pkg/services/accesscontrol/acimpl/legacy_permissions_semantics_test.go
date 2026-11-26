package acimpl

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestLegacyCheckReference_PermissionAssembly(t *testing.T) {
	for _, tc := range []struct {
		name        string
		teamIDs     []int64
		permissions []accesscontrol.Permission
		allowed     bool
	}{
		{
			name:    "contextual team grants are passed to the permission store",
			teamIDs: []int64{7},
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:dash-1"},
			},
			allowed: true,
		},
		{
			name: "without a team or stored grants only SharedWithMe is added",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			permissionStore := &actest.MockStore{}
			permissionStore.On("GetUserPermissions", mock.Anything, accesscontrol.GetUserPermissionsQuery{
				OrgID:        1,
				UserID:       1,
				Roles:        []string{"Viewer"},
				TeamIDs:      tc.teamIDs,
				RolePrefixes: OSSRolesPrefixes,
			}).Return(tc.permissions, nil).Once()
			s := &Service{
				cfg:            setting.NewCfg(),
				features:       featuremgmt.WithFeatures(),
				store:          permissionStore,
				actionResolver: resourcepermissions.NewActionSetService(),
			}
			ident := &user.SignedInUser{
				UserID:  1,
				UserUID: "user-1",
				OrgID:   1,
				OrgRole: "Viewer",
				//nolint:staticcheck // Verify legacy numeric team IDs are passed to the permission store.
				TeamIDs: tc.teamIDs,
			}

			permissions, err := s.getUserPermissions(t.Context(), ident, accesscontrol.Options{})
			require.NoError(t, err)
			permissionStore.AssertExpectations(t)
			want := append([]accesscontrol.Permission{SharedWithMeFolderPermission}, tc.permissions...)
			require.ElementsMatch(t, want, permissions)

			ident.Permissions = map[int64]map[string][]string{
				1: accesscontrol.GroupScopesByActionContext(t.Context(), permissions),
			}
			ac := ProvideAccessControlTest()
			allowed, err := ac.Evaluate(
				t.Context(),
				ident,
				accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:dash-1"),
			)
			require.NoError(t, err)
			require.Equal(t, tc.allowed, allowed)

			allowed, err = ac.Evaluate(t.Context(), ident, accesscontrol.EvalPermission(
				SharedWithMeFolderPermission.Action,
				SharedWithMeFolderPermission.Scope,
			))
			require.NoError(t, err)
			require.True(t, allowed)

			allowed, err = ac.Evaluate(
				t.Context(),
				ident,
				accesscontrol.EvalPermission("folders:read", "folders:uid:unrelated"),
			)
			require.NoError(t, err)
			require.False(t, allowed)
		})
	}
}
