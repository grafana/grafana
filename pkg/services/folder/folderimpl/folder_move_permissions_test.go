package folderimpl_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

// basicRolePermissions collects what the real fixed-role registrations grant a basic role,
// including the grants it inherits from lower roles.
func basicRolePermissions(role org.RoleType) map[string][]string {
	perms := map[string][]string{}
	for _, reg := range api.FixedRoleRegistrations(false, false) {
		granted := false
		for _, g := range reg.Grants {
			if _, ok := accesscontrol.BuiltInRolesWithParents([]string{g})[string(role)]; ok {
				granted = true
			}
		}
		if !granted {
			continue
		}
		for _, p := range reg.Role.Permissions {
			perms[p.Action] = append(perms[p.Action], p.Scope)
		}
	}
	return perms
}

// An org Admin moving a folder into one they created (and so hold the folder Admin action set on)
// must not be treated as an escalation. Admin only; Editors lack several wildcard folder grants.
func TestMoveIntoFolderCreatedByUserIsNotEscalation(t *testing.T) {
	const source, dest = "source-folder", "dest-folder"

	for _, role := range []org.RoleType{org.RoleAdmin} {
		t.Run(string(role), func(t *testing.T) {
			perms := basicRolePermissions(role)

			destScope := folder.ScopeFoldersProvider.GetResourceScopeUID(dest)
			actions := append(append(append([]string{}, ossaccesscontrol.DashboardAdminActions...),
				ossaccesscontrol.NotebookAdminActions...), ossaccesscontrol.FolderAdminActions...)
			// Skip actions registered outside pkg/api (alerting, folder permissions).
			for _, a := range actions {
				if _, held := perms[a]; held {
					perms[a] = append(perms[a], destScope)
				}
			}

			u := &user.SignedInUser{
				OrgID:       1,
				OrgRole:     role,
				Permissions: map[int64]map[string][]string{1: perms},
			}
			svc := folderimpl.NewServiceForMoveTest(acimpl.ProvideAccessControl(featuremgmt.WithFeatures()), folder.NewFakeStore())

			ok, err := svc.CanMove(context.Background(), &folder.MoveFolderCommand{
				UID: source, NewParentUID: dest, OrgID: 1, SignedInUser: u,
			})
			require.NoError(t, err)
			require.True(t, ok)
		})
	}
}
