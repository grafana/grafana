package guardian

import (
	"context"
	"errors"
	"fmt"
	"runtime"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	orgID              = int64(1)
	defaultDashboardID = int64(-1)
	dashboardID        = int64(1)
	parentFolderID     = int64(2)
	childDashboardID   = int64(3)
	userID             = int64(1)
	otherUserID        = int64(2)
	teamID             = int64(1)
	otherTeamID        = int64(2)
)

var (
	adminRole  = models.ROLE_ADMIN
	editorRole = models.ROLE_EDITOR
	viewerRole = models.ROLE_VIEWER
)

func TestGuardianAdmin(t *testing.T) {
	orgRoleScenario("Given user has admin org role", t, models.ROLE_ADMIN, func(sc *scenarioContext) {
		// dashboard has default permissions
		sc.defaultPermissionScenario(USER, FULL_ACCESS)

		// dashboard has user with permission
		sc.dashboardPermissionScenario(USER, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(USER, models.PERMISSION_EDIT, FULL_ACCESS)
		sc.dashboardPermissionScenario(USER, models.PERMISSION_VIEW, FULL_ACCESS)

		// dashboard has team with permission
		sc.dashboardPermissionScenario(TEAM, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(TEAM, models.PERMISSION_EDIT, FULL_ACCESS)
		sc.dashboardPermissionScenario(TEAM, models.PERMISSION_VIEW, FULL_ACCESS)

		// dashboard has editor role with permission
		sc.dashboardPermissionScenario(EDITOR, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(EDITOR, models.PERMISSION_EDIT, FULL_ACCESS)
		sc.dashboardPermissionScenario(EDITOR, models.PERMISSION_VIEW, FULL_ACCESS)

		// dashboard has viewer role with permission
		sc.dashboardPermissionScenario(VIEWER, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(VIEWER, models.PERMISSION_EDIT, FULL_ACCESS)
		sc.dashboardPermissionScenario(VIEWER, models.PERMISSION_VIEW, FULL_ACCESS)

		// parent folder has user with permission
		sc.parentFolderPermissionScenario(USER, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(USER, models.PERMISSION_EDIT, FULL_ACCESS)
		sc.parentFolderPermissionScenario(USER, models.PERMISSION_VIEW, FULL_ACCESS)

		// parent folder has team with permission
		sc.parentFolderPermissionScenario(TEAM, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(TEAM, models.PERMISSION_EDIT, FULL_ACCESS)
		sc.parentFolderPermissionScenario(TEAM, models.PERMISSION_VIEW, FULL_ACCESS)

		// parent folder has editor role with permission
		sc.parentFolderPermissionScenario(EDITOR, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(EDITOR, models.PERMISSION_EDIT, FULL_ACCESS)
		sc.parentFolderPermissionScenario(EDITOR, models.PERMISSION_VIEW, FULL_ACCESS)

		// parent folder has viewer role with permission
		sc.parentFolderPermissionScenario(VIEWER, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(VIEWER, models.PERMISSION_EDIT, FULL_ACCESS)
		sc.parentFolderPermissionScenario(VIEWER, models.PERMISSION_VIEW, FULL_ACCESS)
	})
}

func TestGuardianEditor(t *testing.T) {
	orgRoleScenario("Given user has editor org role", t, models.ROLE_EDITOR, func(sc *scenarioContext) {
		// dashboard has default permissions
		sc.defaultPermissionScenario(USER, EDITOR_ACCESS)

		// dashboard has user with permission
		sc.dashboardPermissionScenario(USER, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(USER, models.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.dashboardPermissionScenario(USER, models.PERMISSION_VIEW, CAN_VIEW)

		// dashboard has team with permission
		sc.dashboardPermissionScenario(TEAM, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(TEAM, models.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.dashboardPermissionScenario(TEAM, models.PERMISSION_VIEW, CAN_VIEW)

		// dashboard has editor role with permission
		sc.dashboardPermissionScenario(EDITOR, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(EDITOR, models.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.dashboardPermissionScenario(EDITOR, models.PERMISSION_VIEW, VIEWER_ACCESS)

		// dashboard has viewer role with permission
		sc.dashboardPermissionScenario(VIEWER, models.PERMISSION_ADMIN, NO_ACCESS)
		sc.dashboardPermissionScenario(VIEWER, models.PERMISSION_EDIT, NO_ACCESS)
		sc.dashboardPermissionScenario(VIEWER, models.PERMISSION_VIEW, NO_ACCESS)

		// parent folder has user with permission
		sc.parentFolderPermissionScenario(USER, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(USER, models.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.parentFolderPermissionScenario(USER, models.PERMISSION_VIEW, VIEWER_ACCESS)

		// parent folder has team with permission
		sc.parentFolderPermissionScenario(TEAM, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(TEAM, models.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.parentFolderPermissionScenario(TEAM, models.PERMISSION_VIEW, VIEWER_ACCESS)

		// parent folder has editor role with permission
		sc.parentFolderPermissionScenario(EDITOR, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(EDITOR, models.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.parentFolderPermissionScenario(EDITOR, models.PERMISSION_VIEW, VIEWER_ACCESS)

		// parent folder has viewer role with permission
		sc.parentFolderPermissionScenario(VIEWER, models.PERMISSION_ADMIN, NO_ACCESS)
		sc.parentFolderPermissionScenario(VIEWER, models.PERMISSION_EDIT, NO_ACCESS)
		sc.parentFolderPermissionScenario(VIEWER, models.PERMISSION_VIEW, NO_ACCESS)
	})
}

func TestGuardianViewer(t *testing.T) {
	orgRoleScenario("Given user has viewer org role", t, models.ROLE_VIEWER, func(sc *scenarioContext) {
		// dashboard has default permissions
		sc.defaultPermissionScenario(USER, VIEWER_ACCESS)

		// dashboard has user with permission
		sc.dashboardPermissionScenario(USER, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(USER, models.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.dashboardPermissionScenario(USER, models.PERMISSION_VIEW, VIEWER_ACCESS)

		// dashboard has team with permission
		sc.dashboardPermissionScenario(TEAM, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(TEAM, models.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.dashboardPermissionScenario(TEAM, models.PERMISSION_VIEW, VIEWER_ACCESS)

		// dashboard has editor role with permission
		sc.dashboardPermissionScenario(EDITOR, models.PERMISSION_ADMIN, NO_ACCESS)
		sc.dashboardPermissionScenario(EDITOR, models.PERMISSION_EDIT, NO_ACCESS)
		sc.dashboardPermissionScenario(EDITOR, models.PERMISSION_VIEW, NO_ACCESS)

		// dashboard has viewer role with permission
		sc.dashboardPermissionScenario(VIEWER, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.dashboardPermissionScenario(VIEWER, models.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.dashboardPermissionScenario(VIEWER, models.PERMISSION_VIEW, VIEWER_ACCESS)

		// parent folder has user with permission
		sc.parentFolderPermissionScenario(USER, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(USER, models.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.parentFolderPermissionScenario(USER, models.PERMISSION_VIEW, VIEWER_ACCESS)

		// parent folder has team with permission
		sc.parentFolderPermissionScenario(TEAM, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(TEAM, models.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.parentFolderPermissionScenario(TEAM, models.PERMISSION_VIEW, VIEWER_ACCESS)

		// parent folder has editor role with permission
		sc.parentFolderPermissionScenario(EDITOR, models.PERMISSION_ADMIN, NO_ACCESS)
		sc.parentFolderPermissionScenario(EDITOR, models.PERMISSION_EDIT, NO_ACCESS)
		sc.parentFolderPermissionScenario(EDITOR, models.PERMISSION_VIEW, NO_ACCESS)

		// parent folder has viewer role with permission
		sc.parentFolderPermissionScenario(VIEWER, models.PERMISSION_ADMIN, FULL_ACCESS)
		sc.parentFolderPermissionScenario(VIEWER, models.PERMISSION_EDIT, EDITOR_ACCESS)
		sc.parentFolderPermissionScenario(VIEWER, models.PERMISSION_VIEW, VIEWER_ACCESS)
	})

	apiKeyScenario("Given api key with viewer role", t, models.ROLE_VIEWER, func(sc *scenarioContext) {
		// dashboard has default permissions
		sc.defaultPermissionScenario(VIEWER, VIEWER_ACCESS)
	})
}

func (sc *scenarioContext) defaultPermissionScenario(pt permissionType, flag permissionFlags) {
	_, callerFile, callerLine, _ := runtime.Caller(1)
	sc.callerFile = callerFile
	sc.callerLine = callerLine
	existingPermissions := []*models.DashboardACLInfoDTO{
		toDto(newEditorRolePermission(defaultDashboardID, models.PERMISSION_EDIT)),
		toDto(newViewerRolePermission(defaultDashboardID, models.PERMISSION_VIEW)),
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

func (sc *scenarioContext) dashboardPermissionScenario(pt permissionType, permission models.PermissionType, flag permissionFlags) {
	_, callerFile, callerLine, _ := runtime.Caller(1)
	sc.callerFile = callerFile
	sc.callerLine = callerLine
	var existingPermissions []*models.DashboardACLInfoDTO

	switch pt {
	case USER:
		existingPermissions = []*models.DashboardACLInfoDTO{{OrgId: orgID, DashboardId: dashboardID, UserId: userID, Permission: permission}}
	case TEAM:
		existingPermissions = []*models.DashboardACLInfoDTO{{OrgId: orgID, DashboardId: dashboardID, TeamId: teamID, Permission: permission}}
	case EDITOR:
		existingPermissions = []*models.DashboardACLInfoDTO{{OrgId: orgID, DashboardId: dashboardID, Role: &editorRole, Permission: permission}}
	case VIEWER:
		existingPermissions = []*models.DashboardACLInfoDTO{{OrgId: orgID, DashboardId: dashboardID, Role: &viewerRole, Permission: permission}}
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

func (sc *scenarioContext) parentFolderPermissionScenario(pt permissionType, permission models.PermissionType, flag permissionFlags) {
	_, callerFile, callerLine, _ := runtime.Caller(1)
	sc.callerFile = callerFile
	sc.callerLine = callerLine
	var folderPermissionList []*models.DashboardACLInfoDTO

	switch pt {
	case USER:
		folderPermissionList = []*models.DashboardACLInfoDTO{{OrgId: orgID, DashboardId: parentFolderID,
			UserId: userID, Permission: permission, Inherited: true}}
	case TEAM:
		folderPermissionList = []*models.DashboardACLInfoDTO{{OrgId: orgID, DashboardId: parentFolderID, TeamId: teamID,
			Permission: permission, Inherited: true}}
	case EDITOR:
		folderPermissionList = []*models.DashboardACLInfoDTO{{OrgId: orgID, DashboardId: parentFolderID,
			Role: &editorRole, Permission: permission, Inherited: true}}
	case VIEWER:
		folderPermissionList = []*models.DashboardACLInfoDTO{{OrgId: orgID, DashboardId: parentFolderID,
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
		p := []*models.DashboardACL{
			newDefaultUserPermission(dashboardID, models.PERMISSION_VIEW),
			newDefaultUserPermission(dashboardID, models.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, p)

		if !errors.Is(err, ErrGuardianPermissionExists) {
			sc.reportFailure(tc, ErrGuardianPermissionExists, err)
		}
		sc.reportSuccess()
	})

	tc = "When updating dashboard permissions with duplicate permission for team should not be allowed"
	sc.t.Run(tc, func(t *testing.T) {
		p := []*models.DashboardACL{
			newDefaultTeamPermission(dashboardID, models.PERMISSION_VIEW),
			newDefaultTeamPermission(dashboardID, models.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, p)
		if !errors.Is(err, ErrGuardianPermissionExists) {
			sc.reportFailure(tc, ErrGuardianPermissionExists, err)
		}
		sc.reportSuccess()
	})

	tc = "When updating dashboard permissions with duplicate permission for editor role should not be allowed"
	sc.t.Run(tc, func(t *testing.T) {
		p := []*models.DashboardACL{
			newEditorRolePermission(dashboardID, models.PERMISSION_VIEW),
			newEditorRolePermission(dashboardID, models.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, p)

		if !errors.Is(err, ErrGuardianPermissionExists) {
			sc.reportFailure(tc, ErrGuardianPermissionExists, err)
		}
		sc.reportSuccess()
	})

	tc = "When updating dashboard permissions with duplicate permission for viewer role should not be allowed"
	sc.t.Run(tc, func(t *testing.T) {
		p := []*models.DashboardACL{
			newViewerRolePermission(dashboardID, models.PERMISSION_VIEW),
			newViewerRolePermission(dashboardID, models.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, p)
		if !errors.Is(err, ErrGuardianPermissionExists) {
			sc.reportFailure(tc, ErrGuardianPermissionExists, err)
		}
		sc.reportSuccess()
	})

	tc = "When updating dashboard permissions with duplicate permission for admin role should not be allowed"
	sc.t.Run(tc, func(t *testing.T) {
		p := []*models.DashboardACL{
			newAdminRolePermission(dashboardID, models.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, p)
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

	for _, p := range []models.PermissionType{models.PERMISSION_ADMIN, models.PERMISSION_EDIT, models.PERMISSION_VIEW} {
		tc := fmt.Sprintf("When updating dashboard permissions with %s permissions should be allowed", p.String())
		sc.t.Run(tc, func(t *testing.T) {
			permissionList := []*models.DashboardACL{}
			switch pt {
			case USER:
				permissionList = []*models.DashboardACL{
					newEditorRolePermission(dashboardID, p),
					newViewerRolePermission(dashboardID, p),
					newCustomUserPermission(dashboardID, otherUserID, p),
					newDefaultTeamPermission(dashboardID, p),
				}
			case TEAM:
				permissionList = []*models.DashboardACL{
					newEditorRolePermission(dashboardID, p),
					newViewerRolePermission(dashboardID, p),
					newDefaultUserPermission(dashboardID, p),
					newCustomTeamPermission(dashboardID, otherTeamID, p),
				}
			case EDITOR, VIEWER:
				permissionList = []*models.DashboardACL{
					newEditorRolePermission(dashboardID, p),
					newViewerRolePermission(dashboardID, p),
					newDefaultUserPermission(dashboardID, p),
					newDefaultTeamPermission(dashboardID, p),
				}
			}

			sc.updatePermissions = permissionList
			ok, err := sc.g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, permissionList)
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

	for _, p := range []models.PermissionType{models.PERMISSION_ADMIN, models.PERMISSION_EDIT, models.PERMISSION_VIEW} {
		tc := fmt.Sprintf("When updating dashboard permissions with %s permissions should NOT be allowed", p.String())
		sc.t.Run(tc, func(t *testing.T) {
			permissionList := []*models.DashboardACL{
				newEditorRolePermission(dashboardID, p),
				newViewerRolePermission(dashboardID, p),
			}
			switch pt {
			case USER:
				permissionList = append(permissionList, []*models.DashboardACL{
					newCustomUserPermission(dashboardID, otherUserID, p),
					newDefaultTeamPermission(dashboardID, p),
				}...)
			case TEAM:
				permissionList = append(permissionList, []*models.DashboardACL{
					newDefaultUserPermission(dashboardID, p),
					newCustomTeamPermission(dashboardID, otherTeamID, p),
				}...)
			default:
				// TODO: Handle other cases?
			}

			sc.updatePermissions = permissionList
			ok, err := sc.g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, permissionList)
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

func (sc *scenarioContext) verifyUpdateChildDashboardPermissionsShouldBeAllowed(pt permissionType, parentFolderPermission models.PermissionType) {
	if !sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []models.PermissionType{models.PERMISSION_ADMIN, models.PERMISSION_EDIT, models.PERMISSION_VIEW} {
		tc := fmt.Sprintf("When updating child dashboard permissions with %s permissions should be allowed", p.String())
		sc.t.Run(tc, func(t *testing.T) {
			permissionList := []*models.DashboardACL{}
			switch pt {
			case USER:
				permissionList = []*models.DashboardACL{
					newEditorRolePermission(childDashboardID, p),
					newViewerRolePermission(childDashboardID, p),
					newCustomUserPermission(childDashboardID, otherUserID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}
			case TEAM:
				permissionList = []*models.DashboardACL{
					newEditorRolePermission(childDashboardID, p),
					newViewerRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newCustomTeamPermission(childDashboardID, otherTeamID, p),
				}
			case EDITOR:
				permissionList = []*models.DashboardACL{
					newViewerRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}

				// permission to update is higher than parent folder permission
				if p > parentFolderPermission {
					permissionList = append(permissionList, newEditorRolePermission(childDashboardID, p))
				}
			case VIEWER:
				permissionList = []*models.DashboardACL{
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
			ok, err := sc.g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, permissionList)
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

func (sc *scenarioContext) verifyUpdateChildDashboardPermissionsShouldNotBeAllowed(pt permissionType, parentFolderPermission models.PermissionType) {
	if sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []models.PermissionType{models.PERMISSION_ADMIN, models.PERMISSION_EDIT, models.PERMISSION_VIEW} {
		tc := fmt.Sprintf("When updating child dashboard permissions with %s permissions should NOT be allowed", p.String())
		sc.t.Run(tc, func(t *testing.T) {
			permissionList := []*models.DashboardACL{}
			switch pt {
			case USER:
				permissionList = []*models.DashboardACL{
					newEditorRolePermission(childDashboardID, p),
					newViewerRolePermission(childDashboardID, p),
					newCustomUserPermission(childDashboardID, otherUserID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}
			case TEAM:
				permissionList = []*models.DashboardACL{
					newEditorRolePermission(childDashboardID, p),
					newViewerRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newCustomTeamPermission(childDashboardID, otherTeamID, p),
				}
			case EDITOR:
				permissionList = []*models.DashboardACL{
					newViewerRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}

				// permission to update is higher than parent folder permission
				if p > parentFolderPermission {
					permissionList = append(permissionList, newEditorRolePermission(childDashboardID, p))
				}
			case VIEWER:
				permissionList = []*models.DashboardACL{
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
			ok, err := sc.g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, permissionList)
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

func (sc *scenarioContext) verifyUpdateChildDashboardPermissionsWithOverrideShouldBeAllowed(pt permissionType, parentFolderPermission models.PermissionType) {
	if !sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []models.PermissionType{models.PERMISSION_ADMIN, models.PERMISSION_EDIT, models.PERMISSION_VIEW} {
		// permission to update is higher than parent folder permission
		if p > parentFolderPermission {
			continue
		}

		tc := fmt.Sprintf("When updating child dashboard permissions overriding parent %s permission with %s permission should NOT be allowed", pt.String(), p.String())
		sc.t.Run(tc, func(t *testing.T) {
			permissionList := []*models.DashboardACL{}
			switch pt {
			case USER:
				permissionList = []*models.DashboardACL{
					newDefaultUserPermission(childDashboardID, p),
				}
			case TEAM:
				permissionList = []*models.DashboardACL{
					newDefaultTeamPermission(childDashboardID, p),
				}
			case EDITOR:
				permissionList = []*models.DashboardACL{
					newEditorRolePermission(childDashboardID, p),
				}
			case VIEWER:
				permissionList = []*models.DashboardACL{
					newViewerRolePermission(childDashboardID, p),
				}
			}

			sc.updatePermissions = permissionList
			_, err := sc.g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, permissionList)
			if !errors.Is(err, ErrGuardianOverride) {
				sc.reportFailure(tc, ErrGuardianOverride, err)
			}
			sc.reportSuccess()
		})
	}
}

func (sc *scenarioContext) verifyUpdateChildDashboardPermissionsWithOverrideShouldNotBeAllowed(pt permissionType, parentFolderPermission models.PermissionType) {
	if !sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []models.PermissionType{models.PERMISSION_ADMIN, models.PERMISSION_EDIT, models.PERMISSION_VIEW} {
		// permission to update is lower than or equal to parent folder permission
		if p <= parentFolderPermission {
			continue
		}

		tc := fmt.Sprintf(
			"When updating child dashboard permissions overriding parent %s permission with %s permission should be allowed",
			pt.String(), p.String(),
		)
		sc.t.Run(tc, func(t *testing.T) {
			permissionList := []*models.DashboardACL{}
			switch pt {
			case USER:
				permissionList = []*models.DashboardACL{
					newDefaultUserPermission(childDashboardID, p),
				}
			case TEAM:
				permissionList = []*models.DashboardACL{
					newDefaultTeamPermission(childDashboardID, p),
				}
			case EDITOR:
				permissionList = []*models.DashboardACL{
					newEditorRolePermission(childDashboardID, p),
				}
			case VIEWER:
				permissionList = []*models.DashboardACL{
					newViewerRolePermission(childDashboardID, p),
				}
			}

			_, err := sc.g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, permissionList)
			if err != nil {
				sc.reportFailure(tc, nil, err)
			}
			sc.updatePermissions = permissionList
			ok, err := sc.g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, permissionList)
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
		store := mockstore.NewSQLStoreMock()
		dashSvc := dashboards.NewFakeDashboardService(t)
		dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*models.GetDashboardACLInfoListQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*models.GetDashboardACLInfoListQuery)
			q.Result = []*models.DashboardACLInfoDTO{
				{Inherited: false, UserId: 1, UserLogin: "user1", Permission: models.PERMISSION_EDIT},
				{Inherited: false, UserId: 2, UserLogin: "user2", Permission: models.PERMISSION_ADMIN},
				{Inherited: true, UserId: 3, UserLogin: "user3", Permission: models.PERMISSION_VIEW},
			}
		}).Return(nil)

		cfg := setting.NewCfg()
		cfg.HiddenUsers = map[string]struct{}{"user2": {}}

		t.Run("Should get hidden acl", func(t *testing.T) {
			user := &models.SignedInUser{
				OrgId:  orgID,
				UserId: 1,
				Login:  "user1",
			}
			g := newDashboardGuardian(context.Background(), dashboardID, orgID, user, store, dashSvc)

			hiddenACL, err := g.GetHiddenACL(cfg)
			require.NoError(t, err)

			require.Equal(t, len(hiddenACL), 1)
			require.Equal(t, hiddenACL[0].UserID, int64(2))
		})

		t.Run("Grafana admin should not get hidden acl", func(t *testing.T) {
			user := &models.SignedInUser{
				OrgId:          orgID,
				UserId:         1,
				Login:          "user1",
				IsGrafanaAdmin: true,
			}
			g := newDashboardGuardian(context.Background(), dashboardID, orgID, user, store, &dashboards.FakeDashboardService{})

			hiddenACL, err := g.GetHiddenACL(cfg)
			require.NoError(t, err)

			require.Equal(t, len(hiddenACL), 0)
		})
	})
}

func TestGuardianGetACLWithoutDuplicates(t *testing.T) {
	t.Run("Get hidden ACL tests", func(t *testing.T) {
		store := mockstore.NewSQLStoreMock()
		dashSvc := dashboards.NewFakeDashboardService(t)
		dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*models.GetDashboardACLInfoListQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*models.GetDashboardACLInfoListQuery)
			q.Result = []*models.DashboardACLInfoDTO{
				{Inherited: true, UserId: 3, UserLogin: "user3", Permission: models.PERMISSION_EDIT},
				{Inherited: false, UserId: 3, UserLogin: "user3", Permission: models.PERMISSION_VIEW},
				{Inherited: false, UserId: 2, UserLogin: "user2", Permission: models.PERMISSION_ADMIN},
				{Inherited: true, UserId: 4, UserLogin: "user4", Permission: models.PERMISSION_ADMIN},
				{Inherited: false, UserId: 4, UserLogin: "user4", Permission: models.PERMISSION_ADMIN},
				{Inherited: false, UserId: 5, UserLogin: "user5", Permission: models.PERMISSION_EDIT},
				{Inherited: true, UserId: 6, UserLogin: "user6", Permission: models.PERMISSION_VIEW},
				{Inherited: false, UserId: 6, UserLogin: "user6", Permission: models.PERMISSION_EDIT},
			}
		}).Return(nil)

		t.Run("Should get acl without duplicates", func(t *testing.T) {
			user := &models.SignedInUser{
				OrgId:  orgID,
				UserId: 1,
				Login:  "user1",
			}
			g := newDashboardGuardian(context.Background(), dashboardID, orgID, user, store, dashSvc)

			acl, err := g.GetACLWithoutDuplicates()
			require.NoError(t, err)
			require.NotNil(t, acl)
			require.Len(t, acl, 6)
			require.ElementsMatch(t, []*models.DashboardACLInfoDTO{
				{Inherited: true, UserId: 3, UserLogin: "user3", Permission: models.PERMISSION_EDIT},
				{Inherited: true, UserId: 4, UserLogin: "user4", Permission: models.PERMISSION_ADMIN},
				{Inherited: true, UserId: 6, UserLogin: "user6", Permission: models.PERMISSION_VIEW},
				{Inherited: false, UserId: 2, UserLogin: "user2", Permission: models.PERMISSION_ADMIN},
				{Inherited: false, UserId: 5, UserLogin: "user5", Permission: models.PERMISSION_EDIT},
				{Inherited: false, UserId: 6, UserLogin: "user6", Permission: models.PERMISSION_EDIT},
			}, acl)
		})
	})
}
