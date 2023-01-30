package guardian

import (
	"context"
	"errors"
	"fmt"
	"runtime"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	orgID              = int64(1)
	defaultDashboardID = int64(-1)
	dashboardID        = int64(1)
	dashboardUID       = "uid"
	parentFolderID     = int64(2)
	childDashboardID   = int64(3)
	userID             = int64(1)
	otherUserID        = int64(2)
	teamID             = int64(1)
	otherTeamID        = int64(2)
)

var (
	adminRole  = org.RoleAdmin
	editorRole = org.RoleEditor
	viewerRole = org.RoleViewer
)

func TestGuardianAdmin(t *testing.T) {
	orgRoleScenario("Given user has admin org role", t, org.RoleAdmin, func(sc *scenarioContext) {
		// dashboard has default permissions
		sc.defaultPermissionScenario(USER, FULL_ACCESS)

		// dashboard has user with permission
		sc.dashboardPermissionScenario(USER, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(USER, dashboards.PERMISSION_EDIT, FULL_ACCESS)
		sc.dashboardPermissionScenario(USER, dashboards.PERMISSION_VIEW, FULL_ACCESS)

		// dashboard has team with permission
		sc.dashboardPermissionScenario(TEAM, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(TEAM, dashboards.PERMISSION_EDIT, FULL_ACCESS)
		sc.dashboardPermissionScenario(TEAM, dashboards.PERMISSION_VIEW, FULL_ACCESS)

		// dashboard has editor role with permission
		sc.dashboardPermissionScenario(EDITOR, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(EDITOR, dashboards.PERMISSION_EDIT, FULL_ACCESS)
		sc.dashboardPermissionScenario(EDITOR, dashboards.PERMISSION_VIEW, FULL_ACCESS)

		// dashboard has viewer role with permission
		sc.dashboardPermissionScenario(VIEWER, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(VIEWER, dashboards.PERMISSION_EDIT, FULL_ACCESS)
		sc.dashboardPermissionScenario(VIEWER, dashboards.PERMISSION_VIEW, FULL_ACCESS)

		// parent folder has user with permission
		sc.parentFolderPermissionScenario(USER, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(USER, dashboards.PERMISSION_EDIT, FULL_ACCESS)
		sc.parentFolderPermissionScenario(USER, dashboards.PERMISSION_VIEW, FULL_ACCESS)

		// parent folder has team with permission
		sc.parentFolderPermissionScenario(TEAM, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(TEAM, dashboards.PERMISSION_EDIT, FULL_ACCESS)
		sc.parentFolderPermissionScenario(TEAM, dashboards.PERMISSION_VIEW, FULL_ACCESS)

		// parent folder has editor role with permission
		sc.parentFolderPermissionScenario(EDITOR, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(EDITOR, dashboards.PERMISSION_EDIT, FULL_ACCESS)
		sc.parentFolderPermissionScenario(EDITOR, dashboards.PERMISSION_VIEW, FULL_ACCESS)

		// parent folder has viewer role with permission
		sc.parentFolderPermissionScenario(VIEWER, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(VIEWER, dashboards.PERMISSION_EDIT, FULL_ACCESS)
		sc.parentFolderPermissionScenario(VIEWER, dashboards.PERMISSION_VIEW, FULL_ACCESS)
	})
}

func TestGuardianEditor(t *testing.T) {
	orgRoleScenario("Given user has editor org role", t, org.RoleEditor, func(sc *scenarioContext) {
		// dashboard has default permissions
		sc.defaultPermissionScenario(USER, EDITOR_ACCESS)

		// dashboard has user with permission
		sc.dashboardPermissionScenario(USER, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(USER, dashboards.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.dashboardPermissionScenario(USER, dashboards.PERMISSION_VIEW, CAN_VIEW)

		// dashboard has team with permission
		sc.dashboardPermissionScenario(TEAM, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(TEAM, dashboards.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.dashboardPermissionScenario(TEAM, dashboards.PERMISSION_VIEW, CAN_VIEW)

		// dashboard has editor role with permission
		sc.dashboardPermissionScenario(EDITOR, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(EDITOR, dashboards.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.dashboardPermissionScenario(EDITOR, dashboards.PERMISSION_VIEW, VIEWER_ACCESS)

		// dashboard has viewer role with permission
		sc.dashboardPermissionScenario(VIEWER, dashboards.PERMISSION_ADMIN, NO_ACCESS)
		sc.dashboardPermissionScenario(VIEWER, dashboards.PERMISSION_EDIT, NO_ACCESS)
		sc.dashboardPermissionScenario(VIEWER, dashboards.PERMISSION_VIEW, NO_ACCESS)

		// parent folder has user with permission
		sc.parentFolderPermissionScenario(USER, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(USER, dashboards.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.parentFolderPermissionScenario(USER, dashboards.PERMISSION_VIEW, VIEWER_ACCESS)

		// parent folder has team with permission
		sc.parentFolderPermissionScenario(TEAM, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(TEAM, dashboards.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.parentFolderPermissionScenario(TEAM, dashboards.PERMISSION_VIEW, VIEWER_ACCESS)

		// parent folder has editor role with permission
		sc.parentFolderPermissionScenario(EDITOR, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(EDITOR, dashboards.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.parentFolderPermissionScenario(EDITOR, dashboards.PERMISSION_VIEW, VIEWER_ACCESS)

		// parent folder has viewer role with permission
		sc.parentFolderPermissionScenario(VIEWER, dashboards.PERMISSION_ADMIN, NO_ACCESS)
		sc.parentFolderPermissionScenario(VIEWER, dashboards.PERMISSION_EDIT, NO_ACCESS)
		sc.parentFolderPermissionScenario(VIEWER, dashboards.PERMISSION_VIEW, NO_ACCESS)
	})
}

func TestGuardianViewer(t *testing.T) {
	orgRoleScenario("Given user has viewer org role", t, org.RoleViewer, func(sc *scenarioContext) {
		// dashboard has default permissions
		sc.defaultPermissionScenario(USER, VIEWER_ACCESS)

		// dashboard has user with permission
		sc.dashboardPermissionScenario(USER, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(USER, dashboards.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.dashboardPermissionScenario(USER, dashboards.PERMISSION_VIEW, VIEWER_ACCESS)

		// dashboard has team with permission
		sc.dashboardPermissionScenario(TEAM, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(TEAM, dashboards.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.dashboardPermissionScenario(TEAM, dashboards.PERMISSION_VIEW, VIEWER_ACCESS)

		// dashboard has editor role with permission
		sc.dashboardPermissionScenario(EDITOR, dashboards.PERMISSION_ADMIN, NO_ACCESS)
		sc.dashboardPermissionScenario(EDITOR, dashboards.PERMISSION_EDIT, NO_ACCESS)
		sc.dashboardPermissionScenario(EDITOR, dashboards.PERMISSION_VIEW, NO_ACCESS)

		// dashboard has viewer role with permission
		sc.dashboardPermissionScenario(VIEWER, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(VIEWER, dashboards.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.dashboardPermissionScenario(VIEWER, dashboards.PERMISSION_VIEW, VIEWER_ACCESS)

		// parent folder has user with permission
		sc.parentFolderPermissionScenario(USER, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(USER, dashboards.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.parentFolderPermissionScenario(USER, dashboards.PERMISSION_VIEW, VIEWER_ACCESS)

		// parent folder has team with permission
		sc.parentFolderPermissionScenario(TEAM, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(TEAM, dashboards.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.parentFolderPermissionScenario(TEAM, dashboards.PERMISSION_VIEW, VIEWER_ACCESS)

		// parent folder has editor role with permission
		sc.parentFolderPermissionScenario(EDITOR, dashboards.PERMISSION_ADMIN, NO_ACCESS)
		sc.parentFolderPermissionScenario(EDITOR, dashboards.PERMISSION_EDIT, NO_ACCESS)
		sc.parentFolderPermissionScenario(EDITOR, dashboards.PERMISSION_VIEW, NO_ACCESS)

		// parent folder has viewer role with permission
		sc.parentFolderPermissionScenario(VIEWER, dashboards.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(VIEWER, dashboards.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.parentFolderPermissionScenario(VIEWER, dashboards.PERMISSION_VIEW, VIEWER_ACCESS)
	})

	apiKeyScenario("Given api key with viewer role", t, org.RoleViewer, func(sc *scenarioContext) {
		// dashboard has default permissions
		sc.defaultPermissionScenario(VIEWER, VIEWER_ACCESS)
	})
}

func (sc *scenarioContext) defaultPermissionScenario(pt permissionType, flag permissionFlags) {
	_, callerFile, callerLine, _ := runtime.Caller(1)
	sc.callerFile = callerFile
	sc.callerLine = callerLine
	existingPermissions := []*dashboards.DashboardACLInfoDTO{
		toDto(newEditorRolePermission(defaultDashboardID, dashboards.PERMISSION_EDIT)),
		toDto(newViewerRolePermission(defaultDashboardID, dashboards.PERMISSION_VIEW)),
	}

	permissionScenario("and existing permissions are the default permissions (everyone with editor role can edit, everyone with viewer role can view)",
		dashboardID, sc, existingPermissions, func(sc *scenarioContext) {
			sc.expectedFlags = flag
			sc.verifyExpectedPermissionsFlags()
			sc.verifyDuplicatePermissionsShouldNotBeAllowed()
			sc.verifyUpdateDashboardPermissionsShouldBeAllowed(pt)
			sc.verifyUpdateDashboardPermissionsShouldNotBeAllowed(pt)
		})
}

func (sc *scenarioContext) dashboardPermissionScenario(pt permissionType, permission dashboards.PermissionType, flag permissionFlags) {
	_, callerFile, callerLine, _ := runtime.Caller(1)
	sc.callerFile = callerFile
	sc.callerLine = callerLine
	var existingPermissions []*dashboards.DashboardACLInfoDTO

	switch pt {
	case USER:
		existingPermissions = []*dashboards.DashboardACLInfoDTO{{OrgID: orgID, DashboardID: dashboardID, UserID: userID, Permission: permission}}
	case TEAM:
		existingPermissions = []*dashboards.DashboardACLInfoDTO{{OrgID: orgID, DashboardID: dashboardID, TeamID: teamID, Permission: permission}}
	case EDITOR:
		existingPermissions = []*dashboards.DashboardACLInfoDTO{{OrgID: orgID, DashboardID: dashboardID, Role: &editorRole, Permission: permission}}
	case VIEWER:
		existingPermissions = []*dashboards.DashboardACLInfoDTO{{OrgID: orgID, DashboardID: dashboardID, Role: &viewerRole, Permission: permission}}
	}

	permissionScenario(fmt.Sprintf("and %s has permission to %s dashboard", pt.String(), permission.String()),
		dashboardID, sc, existingPermissions, func(sc *scenarioContext) {
			sc.expectedFlags = flag
			sc.verifyExpectedPermissionsFlags()
			sc.verifyDuplicatePermissionsShouldNotBeAllowed()
			sc.verifyUpdateDashboardPermissionsShouldBeAllowed(pt)
			sc.verifyUpdateDashboardPermissionsShouldNotBeAllowed(pt)
		})
}

func (sc *scenarioContext) parentFolderPermissionScenario(pt permissionType, permission dashboards.PermissionType, flag permissionFlags) {
	_, callerFile, callerLine, _ := runtime.Caller(1)
	sc.callerFile = callerFile
	sc.callerLine = callerLine
	var folderPermissionList []*dashboards.DashboardACLInfoDTO

	switch pt {
	case USER:
		folderPermissionList = []*dashboards.DashboardACLInfoDTO{{OrgID: orgID, DashboardID: parentFolderID,
			UserID: userID, Permission: permission, Inherited: true}}
	case TEAM:
		folderPermissionList = []*dashboards.DashboardACLInfoDTO{{OrgID: orgID, DashboardID: parentFolderID, TeamID: teamID,
			Permission: permission, Inherited: true}}
	case EDITOR:
		folderPermissionList = []*dashboards.DashboardACLInfoDTO{{OrgID: orgID, DashboardID: parentFolderID,
			Role: &editorRole, Permission: permission, Inherited: true}}
	case VIEWER:
		folderPermissionList = []*dashboards.DashboardACLInfoDTO{{OrgID: orgID, DashboardID: parentFolderID,
			Role: &viewerRole, Permission: permission, Inherited: true}}
	}

	permissionScenario(fmt.Sprintf("and parent folder has %s with permission to %s", pt.String(), permission.String()),
		childDashboardID, sc, folderPermissionList, func(sc *scenarioContext) {
			sc.expectedFlags = flag
			sc.verifyExpectedPermissionsFlags()
			sc.verifyDuplicatePermissionsShouldNotBeAllowed()
			sc.verifyUpdateChildDashboardPermissionsShouldBeAllowed(pt, permission)
			sc.verifyUpdateChildDashboardPermissionsShouldNotBeAllowed(pt, permission)
			sc.verifyUpdateChildDashboardPermissionsWithOverrideShouldBeAllowed(pt, permission)
			sc.verifyUpdateChildDashboardPermissionsWithOverrideShouldNotBeAllowed(pt, permission)
		})
}

func (sc *scenarioContext) verifyExpectedPermissionsFlags() {
	tc := fmt.Sprintf("should have permissions to %s", sc.expectedFlags.String())
	sc.t.Run(tc, func(t *testing.T) {
		canAdmin, err := sc.g.CanAdmin()
		require.NoError(t, err)
		canEdit, err := sc.g.CanEdit()
		require.NoError(t, err)
		canSave, err := sc.g.CanSave()
		require.NoError(t, err)
		canView, err := sc.g.CanView()
		require.NoError(t, err)

		var actualFlag permissionFlags

		if canAdmin {
			actualFlag |= CAN_ADMIN
		}

		if canEdit {
			actualFlag |= CAN_EDIT
		}

		if canSave {
			actualFlag |= CAN_SAVE
		}

		if canView {
			actualFlag |= CAN_VIEW
		}

		if actualFlag.noAccess() {
			actualFlag = NO_ACCESS
		}

		if actualFlag&sc.expectedFlags != actualFlag {
			sc.reportFailure(tc, sc.expectedFlags.String(), actualFlag.String())
		}

		sc.reportSuccess()
	})
}

func (sc *scenarioContext) verifyDuplicatePermissionsShouldNotBeAllowed() {
	if !sc.expectedFlags.canAdmin() {
		return
	}

	tc := "When updating dashboard permissions with duplicate permission for user should not be allowed"
	sc.t.Run(tc, func(t *testing.T) {
		p := []*dashboards.DashboardACL{
			newDefaultUserPermission(dashboardID, dashboards.PERMISSION_VIEW),
			newDefaultUserPermission(dashboardID, dashboards.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(dashboards.PERMISSION_ADMIN, p)

		if !errors.Is(err, ErrGuardianPermissionExists) {
			sc.reportFailure(tc, ErrGuardianPermissionExists, err)
		}
		sc.reportSuccess()
	})

	tc = "When updating dashboard permissions with duplicate permission for team should not be allowed"
	sc.t.Run(tc, func(t *testing.T) {
		p := []*dashboards.DashboardACL{
			newDefaultTeamPermission(dashboardID, dashboards.PERMISSION_VIEW),
			newDefaultTeamPermission(dashboardID, dashboards.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(dashboards.PERMISSION_ADMIN, p)
		if !errors.Is(err, ErrGuardianPermissionExists) {
			sc.reportFailure(tc, ErrGuardianPermissionExists, err)
		}
		sc.reportSuccess()
	})

	tc = "When updating dashboard permissions with duplicate permission for editor role should not be allowed"
	sc.t.Run(tc, func(t *testing.T) {
		p := []*dashboards.DashboardACL{
			newEditorRolePermission(dashboardID, dashboards.PERMISSION_VIEW),
			newEditorRolePermission(dashboardID, dashboards.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(dashboards.PERMISSION_ADMIN, p)

		if !errors.Is(err, ErrGuardianPermissionExists) {
			sc.reportFailure(tc, ErrGuardianPermissionExists, err)
		}
		sc.reportSuccess()
	})

	tc = "When updating dashboard permissions with duplicate permission for viewer role should not be allowed"
	sc.t.Run(tc, func(t *testing.T) {
		p := []*dashboards.DashboardACL{
			newViewerRolePermission(dashboardID, dashboards.PERMISSION_VIEW),
			newViewerRolePermission(dashboardID, dashboards.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(dashboards.PERMISSION_ADMIN, p)
		if !errors.Is(err, ErrGuardianPermissionExists) {
			sc.reportFailure(tc, ErrGuardianPermissionExists, err)
		}
		sc.reportSuccess()
	})

	tc = "When updating dashboard permissions with duplicate permission for admin role should not be allowed"
	sc.t.Run(tc, func(t *testing.T) {
		p := []*dashboards.DashboardACL{
			newAdminRolePermission(dashboardID, dashboards.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(dashboards.PERMISSION_ADMIN, p)
		if !errors.Is(err, ErrGuardianPermissionExists) {
			sc.reportFailure(tc, ErrGuardianPermissionExists, err)
		}
		sc.reportSuccess()
	})
}

func (sc *scenarioContext) verifyUpdateDashboardPermissionsShouldBeAllowed(pt permissionType) {
	if !sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []dashboards.PermissionType{dashboards.PERMISSION_ADMIN, dashboards.PERMISSION_EDIT, dashboards.PERMISSION_VIEW} {
		tc := fmt.Sprintf("When updating dashboard permissions with %s permissions should be allowed", p.String())
		sc.t.Run(tc, func(t *testing.T) {
			permissionList := []*dashboards.DashboardACL{}
			switch pt {
			case USER:
				permissionList = []*dashboards.DashboardACL{
					newEditorRolePermission(dashboardID, p),
					newViewerRolePermission(dashboardID, p),
					newCustomUserPermission(dashboardID, otherUserID, p),
					newDefaultTeamPermission(dashboardID, p),
				}
			case TEAM:
				permissionList = []*dashboards.DashboardACL{
					newEditorRolePermission(dashboardID, p),
					newViewerRolePermission(dashboardID, p),
					newDefaultUserPermission(dashboardID, p),
					newCustomTeamPermission(dashboardID, otherTeamID, p),
				}
			case EDITOR, VIEWER:
				permissionList = []*dashboards.DashboardACL{
					newEditorRolePermission(dashboardID, p),
					newViewerRolePermission(dashboardID, p),
					newDefaultUserPermission(dashboardID, p),
					newDefaultTeamPermission(dashboardID, p),
				}
			}

			sc.updatePermissions = permissionList
			ok, err := sc.g.CheckPermissionBeforeUpdate(dashboards.PERMISSION_ADMIN, permissionList)
			if err != nil {
				sc.reportFailure(tc, nil, err)
			}
			if !ok {
				sc.reportFailure(tc, false, true)
			}
			sc.reportSuccess()
		})
	}
}

func (sc *scenarioContext) verifyUpdateDashboardPermissionsShouldNotBeAllowed(pt permissionType) {
	if sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []dashboards.PermissionType{dashboards.PERMISSION_ADMIN, dashboards.PERMISSION_EDIT, dashboards.PERMISSION_VIEW} {
		tc := fmt.Sprintf("When updating dashboard permissions with %s permissions should NOT be allowed", p.String())
		sc.t.Run(tc, func(t *testing.T) {
			permissionList := []*dashboards.DashboardACL{
				newEditorRolePermission(dashboardID, p),
				newViewerRolePermission(dashboardID, p),
			}
			switch pt {
			case USER:
				permissionList = append(permissionList, []*dashboards.DashboardACL{
					newCustomUserPermission(dashboardID, otherUserID, p),
					newDefaultTeamPermission(dashboardID, p),
				}...)
			case TEAM:
				permissionList = append(permissionList, []*dashboards.DashboardACL{
					newDefaultUserPermission(dashboardID, p),
					newCustomTeamPermission(dashboardID, otherTeamID, p),
				}...)
			default:
				// TODO: Handle other cases?
			}

			sc.updatePermissions = permissionList
			ok, err := sc.g.CheckPermissionBeforeUpdate(dashboards.PERMISSION_ADMIN, permissionList)
			if err != nil {
				sc.reportFailure(tc, nil, err)
			}
			if ok {
				sc.reportFailure(tc, true, false)
			}
			sc.reportSuccess()
		})
	}
}

func (sc *scenarioContext) verifyUpdateChildDashboardPermissionsShouldBeAllowed(pt permissionType, parentFolderPermission dashboards.PermissionType) {
	if !sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []dashboards.PermissionType{dashboards.PERMISSION_ADMIN, dashboards.PERMISSION_EDIT, dashboards.PERMISSION_VIEW} {
		tc := fmt.Sprintf("When updating child dashboard permissions with %s permissions should be allowed", p.String())
		sc.t.Run(tc, func(t *testing.T) {
			permissionList := []*dashboards.DashboardACL{}
			switch pt {
			case USER:
				permissionList = []*dashboards.DashboardACL{
					newEditorRolePermission(childDashboardID, p),
					newViewerRolePermission(childDashboardID, p),
					newCustomUserPermission(childDashboardID, otherUserID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}
			case TEAM:
				permissionList = []*dashboards.DashboardACL{
					newEditorRolePermission(childDashboardID, p),
					newViewerRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newCustomTeamPermission(childDashboardID, otherTeamID, p),
				}
			case EDITOR:
				permissionList = []*dashboards.DashboardACL{
					newViewerRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}

				// permission to update is higher than parent folder permission
				if p > parentFolderPermission {
					permissionList = append(permissionList, newEditorRolePermission(childDashboardID, p))
				}
			case VIEWER:
				permissionList = []*dashboards.DashboardACL{
					newEditorRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}

				// permission to update is higher than parent folder permission
				if p > parentFolderPermission {
					permissionList = append(permissionList, newViewerRolePermission(childDashboardID, p))
				}
			}

			sc.updatePermissions = permissionList
			ok, err := sc.g.CheckPermissionBeforeUpdate(dashboards.PERMISSION_ADMIN, permissionList)
			if err != nil {
				sc.reportFailure(tc, nil, err)
			}
			if !ok {
				sc.reportFailure(tc, false, true)
			}
			sc.reportSuccess()
		})
	}
}

func (sc *scenarioContext) verifyUpdateChildDashboardPermissionsShouldNotBeAllowed(pt permissionType, parentFolderPermission dashboards.PermissionType) {
	if sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []dashboards.PermissionType{dashboards.PERMISSION_ADMIN, dashboards.PERMISSION_EDIT, dashboards.PERMISSION_VIEW} {
		tc := fmt.Sprintf("When updating child dashboard permissions with %s permissions should NOT be allowed", p.String())
		sc.t.Run(tc, func(t *testing.T) {
			permissionList := []*dashboards.DashboardACL{}
			switch pt {
			case USER:
				permissionList = []*dashboards.DashboardACL{
					newEditorRolePermission(childDashboardID, p),
					newViewerRolePermission(childDashboardID, p),
					newCustomUserPermission(childDashboardID, otherUserID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}
			case TEAM:
				permissionList = []*dashboards.DashboardACL{
					newEditorRolePermission(childDashboardID, p),
					newViewerRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newCustomTeamPermission(childDashboardID, otherTeamID, p),
				}
			case EDITOR:
				permissionList = []*dashboards.DashboardACL{
					newViewerRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}

				// permission to update is higher than parent folder permission
				if p > parentFolderPermission {
					permissionList = append(permissionList, newEditorRolePermission(childDashboardID, p))
				}
			case VIEWER:
				permissionList = []*dashboards.DashboardACL{
					newEditorRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}

				// permission to update is higher than parent folder permission
				if p > parentFolderPermission {
					permissionList = append(permissionList, newViewerRolePermission(childDashboardID, p))
				}
			}

			sc.updatePermissions = permissionList
			ok, err := sc.g.CheckPermissionBeforeUpdate(dashboards.PERMISSION_ADMIN, permissionList)
			if err != nil {
				sc.reportFailure(tc, nil, err)
			}
			if ok {
				sc.reportFailure(tc, true, false)
			}
			sc.reportSuccess()
		})
	}
}

func (sc *scenarioContext) verifyUpdateChildDashboardPermissionsWithOverrideShouldBeAllowed(pt permissionType, parentFolderPermission dashboards.PermissionType) {
	if !sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []dashboards.PermissionType{dashboards.PERMISSION_ADMIN, dashboards.PERMISSION_EDIT, dashboards.PERMISSION_VIEW} {
		// permission to update is higher than parent folder permission
		if p > parentFolderPermission {
			continue
		}

		tc := fmt.Sprintf("When updating child dashboard permissions overriding parent %s permission with %s permission should NOT be allowed", pt.String(), p.String())
		sc.t.Run(tc, func(t *testing.T) {
			permissionList := []*dashboards.DashboardACL{}
			switch pt {
			case USER:
				permissionList = []*dashboards.DashboardACL{
					newDefaultUserPermission(childDashboardID, p),
				}
			case TEAM:
				permissionList = []*dashboards.DashboardACL{
					newDefaultTeamPermission(childDashboardID, p),
				}
			case EDITOR:
				permissionList = []*dashboards.DashboardACL{
					newEditorRolePermission(childDashboardID, p),
				}
			case VIEWER:
				permissionList = []*dashboards.DashboardACL{
					newViewerRolePermission(childDashboardID, p),
				}
			}

			sc.updatePermissions = permissionList
			_, err := sc.g.CheckPermissionBeforeUpdate(dashboards.PERMISSION_ADMIN, permissionList)
			if !errors.Is(err, ErrGuardianOverride) {
				sc.reportFailure(tc, ErrGuardianOverride, err)
			}
			sc.reportSuccess()
		})
	}
}

func (sc *scenarioContext) verifyUpdateChildDashboardPermissionsWithOverrideShouldNotBeAllowed(pt permissionType, parentFolderPermission dashboards.PermissionType) {
	if !sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []dashboards.PermissionType{dashboards.PERMISSION_ADMIN, dashboards.PERMISSION_EDIT, dashboards.PERMISSION_VIEW} {
		// permission to update is lower than or equal to parent folder permission
		if p <= parentFolderPermission {
			continue
		}

		tc := fmt.Sprintf(
			"When updating child dashboard permissions overriding parent %s permission with %s permission should be allowed",
			pt.String(), p.String(),
		)
		sc.t.Run(tc, func(t *testing.T) {
			permissionList := []*dashboards.DashboardACL{}
			switch pt {
			case USER:
				permissionList = []*dashboards.DashboardACL{
					newDefaultUserPermission(childDashboardID, p),
				}
			case TEAM:
				permissionList = []*dashboards.DashboardACL{
					newDefaultTeamPermission(childDashboardID, p),
				}
			case EDITOR:
				permissionList = []*dashboards.DashboardACL{
					newEditorRolePermission(childDashboardID, p),
				}
			case VIEWER:
				permissionList = []*dashboards.DashboardACL{
					newViewerRolePermission(childDashboardID, p),
				}
			}

			_, err := sc.g.CheckPermissionBeforeUpdate(dashboards.PERMISSION_ADMIN, permissionList)
			if err != nil {
				sc.reportFailure(tc, nil, err)
			}
			sc.updatePermissions = permissionList
			ok, err := sc.g.CheckPermissionBeforeUpdate(dashboards.PERMISSION_ADMIN, permissionList)
			if err != nil {
				sc.reportFailure(tc, nil, err)
			}
			if !ok {
				sc.reportFailure(tc, false, true)
			}
			sc.reportSuccess()
		})
	}
}

func TestGuardianGetHiddenACL(t *testing.T) {
	t.Run("Get hidden ACL tests", func(t *testing.T) {
		store := dbtest.NewFakeDB()
		dashSvc := dashboards.NewFakeDashboardService(t)
		qResult := []*dashboards.DashboardACLInfoDTO{
			{Inherited: false, UserID: 1, UserLogin: "user1", Permission: dashboards.PERMISSION_EDIT},
			{Inherited: false, UserID: 2, UserLogin: "user2", Permission: dashboards.PERMISSION_ADMIN},
			{Inherited: true, UserID: 3, UserLogin: "user3", Permission: dashboards.PERMISSION_VIEW},
		}
		dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardACLInfoListQuery")).Return(qResult, nil)
		var qResultDash *dashboards.Dashboard
		dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*dashboards.GetDashboardQuery)
			qResultDash = &dashboards.Dashboard{
				ID:    q.ID,
				UID:   q.UID,
				OrgID: q.OrgID,
			}
		}).Return(qResultDash, nil)

		cfg := setting.NewCfg()
		cfg.HiddenUsers = map[string]struct{}{"user2": {}}

		t.Run("Should get hidden acl", func(t *testing.T) {
			user := &user.SignedInUser{
				OrgID:  orgID,
				UserID: 1,
				Login:  "user1",
			}
			g, err := newDashboardGuardian(context.Background(), dashboardID, orgID, user, store, dashSvc, &teamtest.FakeService{})
			require.NoError(t, err)

			hiddenACL, err := g.GetHiddenACL(cfg)
			require.NoError(t, err)

			require.Equal(t, len(hiddenACL), 1)
			require.Equal(t, hiddenACL[0].UserID, int64(2))
		})

		t.Run("Grafana admin should not get hidden acl", func(t *testing.T) {
			user := &user.SignedInUser{
				OrgID:          orgID,
				UserID:         1,
				Login:          "user1",
				IsGrafanaAdmin: true,
			}
			dashSvc := dashboards.NewFakeDashboardService(t)
			qResult := &dashboards.Dashboard{}
			dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Run(func(args mock.Arguments) {
			}).Return(qResult, nil)
			g, err := newDashboardGuardian(context.Background(), dashboardID, orgID, user, store, dashSvc, &teamtest.FakeService{})
			require.NoError(t, err)

			hiddenACL, err := g.GetHiddenACL(cfg)
			require.NoError(t, err)

			require.Equal(t, len(hiddenACL), 0)
		})
	})
}

func TestGuardianGetACLWithoutDuplicates(t *testing.T) {
	t.Run("Get hidden ACL tests", func(t *testing.T) {
		store := dbtest.NewFakeDB()
		dashSvc := dashboards.NewFakeDashboardService(t)
		qResult := []*dashboards.DashboardACLInfoDTO{
			{Inherited: true, UserID: 3, UserLogin: "user3", Permission: dashboards.PERMISSION_EDIT},
			{Inherited: false, UserID: 3, UserLogin: "user3", Permission: dashboards.PERMISSION_VIEW},
			{Inherited: false, UserID: 2, UserLogin: "user2", Permission: dashboards.PERMISSION_ADMIN},
			{Inherited: true, UserID: 4, UserLogin: "user4", Permission: dashboards.PERMISSION_ADMIN},
			{Inherited: false, UserID: 4, UserLogin: "user4", Permission: dashboards.PERMISSION_ADMIN},
			{Inherited: false, UserID: 5, UserLogin: "user5", Permission: dashboards.PERMISSION_EDIT},
			{Inherited: true, UserID: 6, UserLogin: "user6", Permission: dashboards.PERMISSION_VIEW},
			{Inherited: false, UserID: 6, UserLogin: "user6", Permission: dashboards.PERMISSION_EDIT},
		}
		dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardACLInfoListQuery")).Return(qResult, nil)
		qResultDash := &dashboards.Dashboard{}
		dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*dashboards.GetDashboardQuery)
			qResultDash = &dashboards.Dashboard{
				ID:    q.ID,
				UID:   q.UID,
				OrgID: q.OrgID,
			}
		}).Return(qResultDash, nil)

		t.Run("Should get acl without duplicates", func(t *testing.T) {
			user := &user.SignedInUser{
				OrgID:  orgID,
				UserID: 1,
				Login:  "user1",
			}
			g, err := newDashboardGuardian(context.Background(), dashboardID, orgID, user, store, dashSvc, &teamtest.FakeService{})
			require.NoError(t, err)

			acl, err := g.GetACLWithoutDuplicates()
			require.NoError(t, err)
			require.NotNil(t, acl)
			require.Len(t, acl, 6)
			require.ElementsMatch(t, []*dashboards.DashboardACLInfoDTO{
				{Inherited: true, UserID: 3, UserLogin: "user3", Permission: dashboards.PERMISSION_EDIT},
				{Inherited: true, UserID: 4, UserLogin: "user4", Permission: dashboards.PERMISSION_ADMIN},
				{Inherited: true, UserID: 6, UserLogin: "user6", Permission: dashboards.PERMISSION_VIEW},
				{Inherited: false, UserID: 2, UserLogin: "user2", Permission: dashboards.PERMISSION_ADMIN},
				{Inherited: false, UserID: 5, UserLogin: "user5", Permission: dashboards.PERMISSION_EDIT},
				{Inherited: false, UserID: 6, UserLogin: "user6", Permission: dashboards.PERMISSION_EDIT},
			}, acl)
		})
	})
}
