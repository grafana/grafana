package guardian

import (
	"fmt"
	"runtime"
	"testing"

	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

var (
	orgID              = int64(1)
	defaultDashboardID = int64(-1)
	dashboardID        = int64(1)
	parentFolderID     = int64(2)
	childDashboardID   = int64(3)
	userID             = int64(1)
	otherUserID        = int64(2)
	teamID             = int64(1)
	otherTeamID        = int64(2)
	adminRole          = m.ROLE_ADMIN
	editorRole         = m.ROLE_EDITOR
	viewerRole         = m.ROLE_VIEWER
)

func TestGuardianAdmin(t *testing.T) {
	Convey("Guardian admin org role tests", t, func() {
		orgRoleScenario("Given user has admin org role", t, m.ROLE_ADMIN, func(sc *scenarioContext) {
			// dashboard has default permissions
			sc.defaultPermissionScenario(USER, FULL_ACCESS)

			// dashboard has user with permission
			sc.dashboardPermissionScenario(USER, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.dashboardPermissionScenario(USER, m.PERMISSION_EDIT, FULL_ACCESS)
			sc.dashboardPermissionScenario(USER, m.PERMISSION_VIEW, FULL_ACCESS)

			// dashboard has team with permission
			sc.dashboardPermissionScenario(TEAM, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.dashboardPermissionScenario(TEAM, m.PERMISSION_EDIT, FULL_ACCESS)
			sc.dashboardPermissionScenario(TEAM, m.PERMISSION_VIEW, FULL_ACCESS)

			// dashboard has editor role with permission
			sc.dashboardPermissionScenario(EDITOR, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.dashboardPermissionScenario(EDITOR, m.PERMISSION_EDIT, FULL_ACCESS)
			sc.dashboardPermissionScenario(EDITOR, m.PERMISSION_VIEW, FULL_ACCESS)

			// dashboard has viewer role with permission
			sc.dashboardPermissionScenario(VIEWER, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.dashboardPermissionScenario(VIEWER, m.PERMISSION_EDIT, FULL_ACCESS)
			sc.dashboardPermissionScenario(VIEWER, m.PERMISSION_VIEW, FULL_ACCESS)

			// parent folder has user with permission
			sc.parentFolderPermissionScenario(USER, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.parentFolderPermissionScenario(USER, m.PERMISSION_EDIT, FULL_ACCESS)
			sc.parentFolderPermissionScenario(USER, m.PERMISSION_VIEW, FULL_ACCESS)

			// parent folder has team with permission
			sc.parentFolderPermissionScenario(TEAM, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.parentFolderPermissionScenario(TEAM, m.PERMISSION_EDIT, FULL_ACCESS)
			sc.parentFolderPermissionScenario(TEAM, m.PERMISSION_VIEW, FULL_ACCESS)

			// parent folder has editor role with permission
			sc.parentFolderPermissionScenario(EDITOR, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.parentFolderPermissionScenario(EDITOR, m.PERMISSION_EDIT, FULL_ACCESS)
			sc.parentFolderPermissionScenario(EDITOR, m.PERMISSION_VIEW, FULL_ACCESS)

			// parent folder has viweer role with permission
			sc.parentFolderPermissionScenario(VIEWER, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.parentFolderPermissionScenario(VIEWER, m.PERMISSION_EDIT, FULL_ACCESS)
			sc.parentFolderPermissionScenario(VIEWER, m.PERMISSION_VIEW, FULL_ACCESS)
		})
	})
}

func TestGuardianEditor(t *testing.T) {
	Convey("Guardian editor org role tests", t, func() {
		orgRoleScenario("Given user has editor org role", t, m.ROLE_EDITOR, func(sc *scenarioContext) {
			// dashboard has default permissions
			sc.defaultPermissionScenario(USER, EDITOR_ACCESS)

			// dashboard has user with permission
			sc.dashboardPermissionScenario(USER, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.dashboardPermissionScenario(USER, m.PERMISSION_EDIT, EDITOR_ACCESS)
			sc.dashboardPermissionScenario(USER, m.PERMISSION_VIEW, CAN_VIEW)

			// dashboard has team with permission
			sc.dashboardPermissionScenario(TEAM, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.dashboardPermissionScenario(TEAM, m.PERMISSION_EDIT, EDITOR_ACCESS)
			sc.dashboardPermissionScenario(TEAM, m.PERMISSION_VIEW, CAN_VIEW)

			// dashboard has editor role with permission
			sc.dashboardPermissionScenario(EDITOR, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.dashboardPermissionScenario(EDITOR, m.PERMISSION_EDIT, EDITOR_ACCESS)
			sc.dashboardPermissionScenario(EDITOR, m.PERMISSION_VIEW, VIEWER_ACCESS)

			// dashboard has viewer role with permission
			sc.dashboardPermissionScenario(VIEWER, m.PERMISSION_ADMIN, NO_ACCESS)
			sc.dashboardPermissionScenario(VIEWER, m.PERMISSION_EDIT, NO_ACCESS)
			sc.dashboardPermissionScenario(VIEWER, m.PERMISSION_VIEW, NO_ACCESS)

			// parent folder has user with permission
			sc.parentFolderPermissionScenario(USER, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.parentFolderPermissionScenario(USER, m.PERMISSION_EDIT, EDITOR_ACCESS)
			sc.parentFolderPermissionScenario(USER, m.PERMISSION_VIEW, VIEWER_ACCESS)

			// parent folder has team with permission
			sc.parentFolderPermissionScenario(TEAM, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.parentFolderPermissionScenario(TEAM, m.PERMISSION_EDIT, EDITOR_ACCESS)
			sc.parentFolderPermissionScenario(TEAM, m.PERMISSION_VIEW, VIEWER_ACCESS)

			// parent folder has editor role with permission
			sc.parentFolderPermissionScenario(EDITOR, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.parentFolderPermissionScenario(EDITOR, m.PERMISSION_EDIT, EDITOR_ACCESS)
			sc.parentFolderPermissionScenario(EDITOR, m.PERMISSION_VIEW, VIEWER_ACCESS)

			// parent folder has viweer role with permission
			sc.parentFolderPermissionScenario(VIEWER, m.PERMISSION_ADMIN, NO_ACCESS)
			sc.parentFolderPermissionScenario(VIEWER, m.PERMISSION_EDIT, NO_ACCESS)
			sc.parentFolderPermissionScenario(VIEWER, m.PERMISSION_VIEW, NO_ACCESS)
		})
	})
}

func TestGuardianViewer(t *testing.T) {
	Convey("Guardian viewer org role tests", t, func() {
		orgRoleScenario("Given user has viewer org role", t, m.ROLE_VIEWER, func(sc *scenarioContext) {
			// dashboard has default permissions
			sc.defaultPermissionScenario(USER, VIEWER_ACCESS)

			// dashboard has user with permission
			sc.dashboardPermissionScenario(USER, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.dashboardPermissionScenario(USER, m.PERMISSION_EDIT, EDITOR_ACCESS)
			sc.dashboardPermissionScenario(USER, m.PERMISSION_VIEW, VIEWER_ACCESS)

			// dashboard has team with permission
			sc.dashboardPermissionScenario(TEAM, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.dashboardPermissionScenario(TEAM, m.PERMISSION_EDIT, EDITOR_ACCESS)
			sc.dashboardPermissionScenario(TEAM, m.PERMISSION_VIEW, VIEWER_ACCESS)

			// dashboard has editor role with permission
			sc.dashboardPermissionScenario(EDITOR, m.PERMISSION_ADMIN, NO_ACCESS)
			sc.dashboardPermissionScenario(EDITOR, m.PERMISSION_EDIT, NO_ACCESS)
			sc.dashboardPermissionScenario(EDITOR, m.PERMISSION_VIEW, NO_ACCESS)

			// dashboard has viewer role with permission
			sc.dashboardPermissionScenario(VIEWER, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.dashboardPermissionScenario(VIEWER, m.PERMISSION_EDIT, EDITOR_ACCESS)
			sc.dashboardPermissionScenario(VIEWER, m.PERMISSION_VIEW, VIEWER_ACCESS)

			// parent folder has user with permission
			sc.parentFolderPermissionScenario(USER, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.parentFolderPermissionScenario(USER, m.PERMISSION_EDIT, EDITOR_ACCESS)
			sc.parentFolderPermissionScenario(USER, m.PERMISSION_VIEW, VIEWER_ACCESS)

			// parent folder has team with permission
			sc.parentFolderPermissionScenario(TEAM, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.parentFolderPermissionScenario(TEAM, m.PERMISSION_EDIT, EDITOR_ACCESS)
			sc.parentFolderPermissionScenario(TEAM, m.PERMISSION_VIEW, VIEWER_ACCESS)

			// parent folder has editor role with permission
			sc.parentFolderPermissionScenario(EDITOR, m.PERMISSION_ADMIN, NO_ACCESS)
			sc.parentFolderPermissionScenario(EDITOR, m.PERMISSION_EDIT, NO_ACCESS)
			sc.parentFolderPermissionScenario(EDITOR, m.PERMISSION_VIEW, NO_ACCESS)

			// parent folder has viweer role with permission
			sc.parentFolderPermissionScenario(VIEWER, m.PERMISSION_ADMIN, FULL_ACCESS)
			sc.parentFolderPermissionScenario(VIEWER, m.PERMISSION_EDIT, EDITOR_ACCESS)
			sc.parentFolderPermissionScenario(VIEWER, m.PERMISSION_VIEW, VIEWER_ACCESS)
		})

		apiKeyScenario("Given api key with viewer role", t, m.ROLE_VIEWER, func(sc *scenarioContext) {
			// dashboard has default permissions
			sc.defaultPermissionScenario(VIEWER, VIEWER_ACCESS)
		})
	})
}

func (sc *scenarioContext) defaultPermissionScenario(pt permissionType, flag permissionFlags) {
	_, callerFile, callerLine, _ := runtime.Caller(1)
	sc.callerFile = callerFile
	sc.callerLine = callerLine
	existingPermissions := []*m.DashboardAclInfoDTO{
		toDto(newEditorRolePermission(defaultDashboardID, m.PERMISSION_EDIT)),
		toDto(newViewerRolePermission(defaultDashboardID, m.PERMISSION_VIEW)),
	}

	permissionScenario("and existing permissions is the default permissions (everyone with editor role can edit, everyone with viewer role can view)", dashboardID, sc, existingPermissions, func(sc *scenarioContext) {
		sc.expectedFlags = flag
		sc.verifyExpectedPermissionsFlags()
		sc.verifyDuplicatePermissionsShouldNotBeAllowed()
		sc.verifyUpdateDashboardPermissionsShouldBeAllowed(pt)
		sc.verifyUpdateDashboardPermissionsShouldNotBeAllowed(pt)
	})
}

func (sc *scenarioContext) dashboardPermissionScenario(pt permissionType, permission m.PermissionType, flag permissionFlags) {
	_, callerFile, callerLine, _ := runtime.Caller(1)
	sc.callerFile = callerFile
	sc.callerLine = callerLine
	var existingPermissions []*m.DashboardAclInfoDTO

	switch pt {
	case USER:
		existingPermissions = []*m.DashboardAclInfoDTO{{OrgId: orgID, DashboardId: dashboardID, UserId: userID, Permission: permission}}
	case TEAM:
		existingPermissions = []*m.DashboardAclInfoDTO{{OrgId: orgID, DashboardId: dashboardID, TeamId: teamID, Permission: permission}}
	case EDITOR:
		existingPermissions = []*m.DashboardAclInfoDTO{{OrgId: orgID, DashboardId: dashboardID, Role: &editorRole, Permission: permission}}
	case VIEWER:
		existingPermissions = []*m.DashboardAclInfoDTO{{OrgId: orgID, DashboardId: dashboardID, Role: &viewerRole, Permission: permission}}
	}

	permissionScenario(fmt.Sprintf("and %s has permission to %s dashboard", pt.String(), permission.String()), dashboardID, sc, existingPermissions, func(sc *scenarioContext) {
		sc.expectedFlags = flag
		sc.verifyExpectedPermissionsFlags()
		sc.verifyDuplicatePermissionsShouldNotBeAllowed()
		sc.verifyUpdateDashboardPermissionsShouldBeAllowed(pt)
		sc.verifyUpdateDashboardPermissionsShouldNotBeAllowed(pt)
	})
}

func (sc *scenarioContext) parentFolderPermissionScenario(pt permissionType, permission m.PermissionType, flag permissionFlags) {
	_, callerFile, callerLine, _ := runtime.Caller(1)
	sc.callerFile = callerFile
	sc.callerLine = callerLine
	var folderPermissionList []*m.DashboardAclInfoDTO

	switch pt {
	case USER:
		folderPermissionList = []*m.DashboardAclInfoDTO{{OrgId: orgID, DashboardId: parentFolderID, UserId: userID, Permission: permission, Inherited: true}}
	case TEAM:
		folderPermissionList = []*m.DashboardAclInfoDTO{{OrgId: orgID, DashboardId: parentFolderID, TeamId: teamID, Permission: permission, Inherited: true}}
	case EDITOR:
		folderPermissionList = []*m.DashboardAclInfoDTO{{OrgId: orgID, DashboardId: parentFolderID, Role: &editorRole, Permission: permission, Inherited: true}}
	case VIEWER:
		folderPermissionList = []*m.DashboardAclInfoDTO{{OrgId: orgID, DashboardId: parentFolderID, Role: &viewerRole, Permission: permission, Inherited: true}}
	}

	permissionScenario(fmt.Sprintf("and parent folder has %s with permission to %s", pt.String(), permission.String()), childDashboardID, sc, folderPermissionList, func(sc *scenarioContext) {
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
	canAdmin, _ := sc.g.CanAdmin()
	canEdit, _ := sc.g.CanEdit()
	canSave, _ := sc.g.CanSave()
	canView, _ := sc.g.CanView()

	tc := fmt.Sprintf("should have permissions to %s", sc.expectedFlags.String())
	Convey(tc, func() {
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
	Convey(tc, func() {
		p := []*m.DashboardAcl{
			newDefaultUserPermission(dashboardID, m.PERMISSION_VIEW),
			newDefaultUserPermission(dashboardID, m.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)

		if err != ErrGuardianPermissionExists {
			sc.reportFailure(tc, ErrGuardianPermissionExists, err)
		}
		sc.reportSuccess()
	})

	tc = "When updating dashboard permissions with duplicate permission for team should not be allowed"
	Convey(tc, func() {
		p := []*m.DashboardAcl{
			newDefaultTeamPermission(dashboardID, m.PERMISSION_VIEW),
			newDefaultTeamPermission(dashboardID, m.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)

		if err != ErrGuardianPermissionExists {
			sc.reportFailure(tc, ErrGuardianPermissionExists, err)
		}
		sc.reportSuccess()
	})

	tc = "When updating dashboard permissions with duplicate permission for editor role should not be allowed"
	Convey(tc, func() {
		p := []*m.DashboardAcl{
			newEditorRolePermission(dashboardID, m.PERMISSION_VIEW),
			newEditorRolePermission(dashboardID, m.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)

		if err != ErrGuardianPermissionExists {
			sc.reportFailure(tc, ErrGuardianPermissionExists, err)
		}
		sc.reportSuccess()
	})

	tc = "When updating dashboard permissions with duplicate permission for viewer role should not be allowed"
	Convey(tc, func() {
		p := []*m.DashboardAcl{
			newViewerRolePermission(dashboardID, m.PERMISSION_VIEW),
			newViewerRolePermission(dashboardID, m.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)

		if err != ErrGuardianPermissionExists {
			sc.reportFailure(tc, ErrGuardianPermissionExists, err)
		}
		sc.reportSuccess()
	})

	tc = "When updating dashboard permissions with duplicate permission for admin role should not be allowed"
	Convey(tc, func() {
		p := []*m.DashboardAcl{
			newAdminRolePermission(dashboardID, m.PERMISSION_ADMIN),
		}
		sc.updatePermissions = p
		_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)

		if err != ErrGuardianPermissionExists {
			sc.reportFailure(tc, ErrGuardianPermissionExists, err)
		}
		sc.reportSuccess()
	})
}

func (sc *scenarioContext) verifyUpdateDashboardPermissionsShouldBeAllowed(pt permissionType) {
	if !sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []m.PermissionType{m.PERMISSION_ADMIN, m.PERMISSION_EDIT, m.PERMISSION_VIEW} {
		tc := fmt.Sprintf("When updating dashboard permissions with %s permissions should be allowed", p.String())

		Convey(tc, func() {
			permissionList := []*m.DashboardAcl{}
			switch pt {
			case USER:
				permissionList = []*m.DashboardAcl{
					newEditorRolePermission(dashboardID, p),
					newViewerRolePermission(dashboardID, p),
					newCustomUserPermission(dashboardID, otherUserID, p),
					newDefaultTeamPermission(dashboardID, p),
				}
			case TEAM:
				permissionList = []*m.DashboardAcl{
					newEditorRolePermission(dashboardID, p),
					newViewerRolePermission(dashboardID, p),
					newDefaultUserPermission(dashboardID, p),
					newCustomTeamPermission(dashboardID, otherTeamID, p),
				}
			case EDITOR, VIEWER:
				permissionList = []*m.DashboardAcl{
					newEditorRolePermission(dashboardID, p),
					newViewerRolePermission(dashboardID, p),
					newDefaultUserPermission(dashboardID, p),
					newDefaultTeamPermission(dashboardID, p),
				}
			}

			sc.updatePermissions = permissionList
			ok, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, permissionList)

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

	for _, p := range []m.PermissionType{m.PERMISSION_ADMIN, m.PERMISSION_EDIT, m.PERMISSION_VIEW} {
		tc := fmt.Sprintf("When updating dashboard permissions with %s permissions should NOT be allowed", p.String())

		Convey(tc, func() {
			permissionList := []*m.DashboardAcl{
				newEditorRolePermission(dashboardID, p),
				newViewerRolePermission(dashboardID, p),
			}
			switch pt {
			case USER:
				permissionList = append(permissionList, []*m.DashboardAcl{
					newCustomUserPermission(dashboardID, otherUserID, p),
					newDefaultTeamPermission(dashboardID, p),
				}...)
			case TEAM:
				permissionList = append(permissionList, []*m.DashboardAcl{
					newDefaultUserPermission(dashboardID, p),
					newCustomTeamPermission(dashboardID, otherTeamID, p),
				}...)
			}

			sc.updatePermissions = permissionList
			ok, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, permissionList)

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

func (sc *scenarioContext) verifyUpdateChildDashboardPermissionsShouldBeAllowed(pt permissionType, parentFolderPermission m.PermissionType) {
	if !sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []m.PermissionType{m.PERMISSION_ADMIN, m.PERMISSION_EDIT, m.PERMISSION_VIEW} {
		tc := fmt.Sprintf("When updating child dashboard permissions with %s permissions should be allowed", p.String())

		Convey(tc, func() {
			permissionList := []*m.DashboardAcl{}
			switch pt {
			case USER:
				permissionList = []*m.DashboardAcl{
					newEditorRolePermission(childDashboardID, p),
					newViewerRolePermission(childDashboardID, p),
					newCustomUserPermission(childDashboardID, otherUserID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}
			case TEAM:
				permissionList = []*m.DashboardAcl{
					newEditorRolePermission(childDashboardID, p),
					newViewerRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newCustomTeamPermission(childDashboardID, otherTeamID, p),
				}
			case EDITOR:
				permissionList = []*m.DashboardAcl{
					newViewerRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}

				// permission to update is higher than parent folder permission
				if p > parentFolderPermission {
					permissionList = append(permissionList, newEditorRolePermission(childDashboardID, p))
				}
			case VIEWER:
				permissionList = []*m.DashboardAcl{
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
			ok, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, permissionList)

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

func (sc *scenarioContext) verifyUpdateChildDashboardPermissionsShouldNotBeAllowed(pt permissionType, parentFolderPermission m.PermissionType) {
	if sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []m.PermissionType{m.PERMISSION_ADMIN, m.PERMISSION_EDIT, m.PERMISSION_VIEW} {
		tc := fmt.Sprintf("When updating child dashboard permissions with %s permissions should NOT be allowed", p.String())

		Convey(tc, func() {
			permissionList := []*m.DashboardAcl{}
			switch pt {
			case USER:
				permissionList = []*m.DashboardAcl{
					newEditorRolePermission(childDashboardID, p),
					newViewerRolePermission(childDashboardID, p),
					newCustomUserPermission(childDashboardID, otherUserID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}
			case TEAM:
				permissionList = []*m.DashboardAcl{
					newEditorRolePermission(childDashboardID, p),
					newViewerRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newCustomTeamPermission(childDashboardID, otherTeamID, p),
				}
			case EDITOR:
				permissionList = []*m.DashboardAcl{
					newViewerRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}

				// perminssion to update is higher than parent folder permission
				if p > parentFolderPermission {
					permissionList = append(permissionList, newEditorRolePermission(childDashboardID, p))
				}
			case VIEWER:
				permissionList = []*m.DashboardAcl{
					newEditorRolePermission(childDashboardID, p),
					newDefaultUserPermission(childDashboardID, p),
					newDefaultTeamPermission(childDashboardID, p),
				}

				// perminssion to update is higher than parent folder permission
				if p > parentFolderPermission {
					permissionList = append(permissionList, newViewerRolePermission(childDashboardID, p))
				}
			}

			sc.updatePermissions = permissionList
			ok, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, permissionList)

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

func (sc *scenarioContext) verifyUpdateChildDashboardPermissionsWithOverrideShouldBeAllowed(pt permissionType, parentFolderPermission m.PermissionType) {
	if !sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []m.PermissionType{m.PERMISSION_ADMIN, m.PERMISSION_EDIT, m.PERMISSION_VIEW} {
		// perminssion to update is higher tban parent folder permission
		if p > parentFolderPermission {
			continue
		}

		tc := fmt.Sprintf("When updating child dashboard permissions overriding parent %s permission with %s permission should NOT be allowed", pt.String(), p.String())

		Convey(tc, func() {
			permissionList := []*m.DashboardAcl{}
			switch pt {
			case USER:
				permissionList = []*m.DashboardAcl{
					newDefaultUserPermission(childDashboardID, p),
				}
			case TEAM:
				permissionList = []*m.DashboardAcl{
					newDefaultTeamPermission(childDashboardID, p),
				}
			case EDITOR:
				permissionList = []*m.DashboardAcl{
					newEditorRolePermission(childDashboardID, p),
				}
			case VIEWER:
				permissionList = []*m.DashboardAcl{
					newViewerRolePermission(childDashboardID, p),
				}
			}

			sc.updatePermissions = permissionList
			_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, permissionList)

			if err != ErrGuardianOverride {
				sc.reportFailure(tc, ErrGuardianOverride, err)
			}
			sc.reportSuccess()
		})
	}
}

func (sc *scenarioContext) verifyUpdateChildDashboardPermissionsWithOverrideShouldNotBeAllowed(pt permissionType, parentFolderPermission m.PermissionType) {
	if !sc.expectedFlags.canAdmin() {
		return
	}

	for _, p := range []m.PermissionType{m.PERMISSION_ADMIN, m.PERMISSION_EDIT, m.PERMISSION_VIEW} {
		// perminssion to update is lower than/equal parent folder permission
		if p <= parentFolderPermission {
			continue
		}

		tc := fmt.Sprintf("When updating child dashboard permissions overriding parent %s permission with %s permission should be allowed", pt.String(), p.String())

		Convey(tc, func() {
			permissionList := []*m.DashboardAcl{}
			switch pt {
			case USER:
				permissionList = []*m.DashboardAcl{
					newDefaultUserPermission(childDashboardID, p),
				}
			case TEAM:
				permissionList = []*m.DashboardAcl{
					newDefaultTeamPermission(childDashboardID, p),
				}
			case EDITOR:
				permissionList = []*m.DashboardAcl{
					newEditorRolePermission(childDashboardID, p),
				}
			case VIEWER:
				permissionList = []*m.DashboardAcl{
					newViewerRolePermission(childDashboardID, p),
				}
			}

			_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, permissionList)
			if err != nil {
				sc.reportFailure(tc, nil, err)
			}
			sc.updatePermissions = permissionList
			ok, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, permissionList)

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
