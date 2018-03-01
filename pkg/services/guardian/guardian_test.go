package guardian

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/bus"

	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestGuardian(t *testing.T) {
	Convey("Guardian permission tests", t, func() {
		orgRoleScenario("Given user has admin org role", m.ROLE_ADMIN, func(sc *scenarioContext) {
			canAdmin, _ := sc.g.CanAdmin()
			canEdit, _ := sc.g.CanEdit()
			canSave, _ := sc.g.CanSave()
			canView, _ := sc.g.CanView()
			So(canAdmin, ShouldBeTrue)
			So(canEdit, ShouldBeTrue)
			So(canSave, ShouldBeTrue)
			So(canView, ShouldBeTrue)

			Convey("When trying to update permissions", func() {
				Convey("With duplicate user permissions should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_VIEW},
						{OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_ADMIN},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianPermissionExists)
				})

				Convey("With duplicate team permissions should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 1, TeamId: 1, Permission: m.PERMISSION_VIEW},
						{OrgId: 1, DashboardId: 1, TeamId: 1, Permission: m.PERMISSION_ADMIN},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianPermissionExists)
				})

				Convey("With duplicate everyone with editor role permission should return error", func() {
					r := m.ROLE_EDITOR
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 1, Role: &r, Permission: m.PERMISSION_VIEW},
						{OrgId: 1, DashboardId: 1, Role: &r, Permission: m.PERMISSION_ADMIN},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianPermissionExists)
				})

				Convey("With duplicate everyone with viewer role permission should return error", func() {
					r := m.ROLE_VIEWER
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 1, Role: &r, Permission: m.PERMISSION_VIEW},
						{OrgId: 1, DashboardId: 1, Role: &r, Permission: m.PERMISSION_ADMIN},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianPermissionExists)
				})

				Convey("With everyone with admin role permission should return error", func() {
					r := m.ROLE_ADMIN
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 1, Role: &r, Permission: m.PERMISSION_ADMIN},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianPermissionExists)
				})
			})

			Convey("Given default permissions", func() {
				editor := m.ROLE_EDITOR
				viewer := m.ROLE_VIEWER
				existingPermissions := []*m.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: -1, Role: &editor, Permission: m.PERMISSION_EDIT},
					{OrgId: 1, DashboardId: -1, Role: &viewer, Permission: m.PERMISSION_VIEW},
				}

				bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
					query.Result = existingPermissions
					return nil
				})

				Convey("When trying to update dashboard permissions without everyone with role editor can edit should be allowed", func() {
					r := m.ROLE_VIEWER
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 1, Role: &r, Permission: m.PERMISSION_VIEW},
					}
					ok, _ := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(ok, ShouldBeTrue)
				})

				Convey("When trying to update dashboard permissions without everyone with role viewer can view should be allowed", func() {
					r := m.ROLE_EDITOR
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 1, Role: &r, Permission: m.PERMISSION_EDIT},
					}
					ok, _ := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(ok, ShouldBeTrue)
				})
			})

			Convey("Given parent folder has user admin permission", func() {
				existingPermissions := []*m.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 2, UserId: 1, Permission: m.PERMISSION_ADMIN},
				}

				bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
					query.Result = existingPermissions
					return nil
				})

				Convey("When trying to update dashboard permissions with admin user permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, UserId: 1, Permission: m.PERMISSION_ADMIN},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})

				Convey("When trying to update dashboard permissions with edit user permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, UserId: 1, Permission: m.PERMISSION_EDIT},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})

				Convey("When trying to update dashboard permissions with view user permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, UserId: 1, Permission: m.PERMISSION_VIEW},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})
			})

			Convey("Given parent folder has user edit permission", func() {
				existingPermissions := []*m.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 2, UserId: 1, Permission: m.PERMISSION_EDIT},
				}

				bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
					query.Result = existingPermissions
					return nil
				})

				Convey("When trying to update dashboard permissions with admin user permission should be allowed", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, UserId: 1, Permission: m.PERMISSION_ADMIN},
					}
					ok, _ := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(ok, ShouldBeTrue)
				})

				Convey("When trying to update dashboard permissions with edit user permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, UserId: 1, Permission: m.PERMISSION_EDIT},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})

				Convey("When trying to update dashboard permissions with view user permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, UserId: 1, Permission: m.PERMISSION_VIEW},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})
			})

			Convey("Given parent folder has user view permission", func() {
				existingPermissions := []*m.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 2, UserId: 1, Permission: m.PERMISSION_VIEW},
				}

				bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
					query.Result = existingPermissions
					return nil
				})

				Convey("When trying to update dashboard permissions with admin user permission should be allowed", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, UserId: 1, Permission: m.PERMISSION_ADMIN},
					}
					ok, _ := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(ok, ShouldBeTrue)
				})

				Convey("When trying to update dashboard permissions with edit user permission should be allowed", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, UserId: 1, Permission: m.PERMISSION_EDIT},
					}
					ok, _ := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(ok, ShouldBeTrue)
				})

				Convey("When trying to update dashboard permissions with view user permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, UserId: 1, Permission: m.PERMISSION_VIEW},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})
			})

			Convey("Given parent folder has team admin permission", func() {
				existingPermissions := []*m.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 2, TeamId: 1, Permission: m.PERMISSION_ADMIN},
				}

				bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
					query.Result = existingPermissions
					return nil
				})

				Convey("When trying to update dashboard permissions with admin team permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, TeamId: 1, Permission: m.PERMISSION_ADMIN},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})

				Convey("When trying to update dashboard permissions with edit team permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, TeamId: 1, Permission: m.PERMISSION_EDIT},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})

				Convey("When trying to update dashboard permissions with view team permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, TeamId: 1, Permission: m.PERMISSION_VIEW},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})
			})

			Convey("Given parent folder has team edit permission", func() {
				existingPermissions := []*m.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 2, TeamId: 1, Permission: m.PERMISSION_EDIT},
				}

				bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
					query.Result = existingPermissions
					return nil
				})

				Convey("When trying to update dashboard permissions with admin team permission should be allowed", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, TeamId: 1, Permission: m.PERMISSION_ADMIN},
					}
					ok, _ := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(ok, ShouldBeTrue)
				})

				Convey("When trying to update dashboard permissions with edit team permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, TeamId: 1, Permission: m.PERMISSION_EDIT},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})

				Convey("When trying to update dashboard permissions with view team permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, TeamId: 1, Permission: m.PERMISSION_VIEW},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})
			})

			Convey("Given parent folder has team view permission", func() {
				existingPermissions := []*m.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 2, TeamId: 1, Permission: m.PERMISSION_VIEW},
				}

				bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
					query.Result = existingPermissions
					return nil
				})

				Convey("When trying to update dashboard permissions with admin team permission should be allowed", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, TeamId: 1, Permission: m.PERMISSION_ADMIN},
					}
					ok, _ := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(ok, ShouldBeTrue)
				})

				Convey("When trying to update dashboard permissions with edit team permission should be allowed", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, TeamId: 1, Permission: m.PERMISSION_EDIT},
					}
					ok, _ := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(ok, ShouldBeTrue)
				})

				Convey("When trying to update dashboard permissions with view team permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, TeamId: 1, Permission: m.PERMISSION_VIEW},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})
			})

			Convey("Given parent folder has editor role with edit permission", func() {
				r := m.ROLE_EDITOR
				existingPermissions := []*m.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 2, Role: &r, Permission: m.PERMISSION_EDIT},
				}

				bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
					query.Result = existingPermissions
					return nil
				})

				Convey("When trying to update dashboard permissions with everyone with editor role can admin permission should be allowed", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, Role: &r, Permission: m.PERMISSION_ADMIN},
					}
					ok, _ := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(ok, ShouldBeTrue)
				})

				Convey("When trying to update dashboard permissions with everyone with editor role can edit permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, Role: &r, Permission: m.PERMISSION_EDIT},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})

				Convey("When trying to update dashboard permissions with everyone with editor role can view permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, Role: &r, Permission: m.PERMISSION_VIEW},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})
			})

			Convey("Given parent folder has editor role with view permission", func() {
				r := m.ROLE_EDITOR
				existingPermissions := []*m.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 2, Role: &r, Permission: m.PERMISSION_VIEW},
				}

				bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
					query.Result = existingPermissions
					return nil
				})

				Convey("When trying to update dashboard permissions with everyone with viewer role can admin permission should be allowed", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, Role: &r, Permission: m.PERMISSION_ADMIN},
					}
					ok, _ := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(ok, ShouldBeTrue)
				})

				Convey("When trying to update dashboard permissions with everyone with viewer role can edit permission should be allowed", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, Role: &r, Permission: m.PERMISSION_EDIT},
					}
					ok, _ := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(ok, ShouldBeTrue)
				})

				Convey("When trying to update dashboard permissions with everyone with viewer role can view permission should return error", func() {
					p := []*m.DashboardAcl{
						{OrgId: 1, DashboardId: 3, Role: &r, Permission: m.PERMISSION_VIEW},
					}
					_, err := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
					So(err, ShouldEqual, ErrGuardianOverride)
				})
			})
		})

		orgRoleScenario("Given user has editor org role", m.ROLE_EDITOR, func(sc *scenarioContext) {
			everyoneWithRoleScenario(m.ROLE_EDITOR, m.PERMISSION_ADMIN, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeTrue)
				So(canEdit, ShouldBeTrue)
				So(canSave, ShouldBeTrue)
				So(canView, ShouldBeTrue)
			})

			everyoneWithRoleScenario(m.ROLE_EDITOR, m.PERMISSION_EDIT, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeTrue)
				So(canSave, ShouldBeTrue)
				So(canView, ShouldBeTrue)
			})

			everyoneWithRoleScenario(m.ROLE_EDITOR, m.PERMISSION_VIEW, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeFalse)
				So(canSave, ShouldBeFalse)
				So(canView, ShouldBeTrue)
			})

			everyoneWithRoleScenario(m.ROLE_VIEWER, m.PERMISSION_ADMIN, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeFalse)
				So(canSave, ShouldBeFalse)
				So(canView, ShouldBeFalse)
			})

			everyoneWithRoleScenario(m.ROLE_VIEWER, m.PERMISSION_EDIT, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeFalse)
				So(canSave, ShouldBeFalse)
				So(canView, ShouldBeFalse)
			})

			everyoneWithRoleScenario(m.ROLE_VIEWER, m.PERMISSION_VIEW, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeFalse)
				So(canSave, ShouldBeFalse)
				So(canView, ShouldBeFalse)
			})

			userWithPermissionScenario(m.PERMISSION_ADMIN, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeTrue)
				So(canEdit, ShouldBeTrue)
				So(canSave, ShouldBeTrue)
				So(canView, ShouldBeTrue)
			})

			userWithPermissionScenario(m.PERMISSION_EDIT, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeTrue)
				So(canSave, ShouldBeTrue)
				So(canView, ShouldBeTrue)
			})

			userWithPermissionScenario(m.PERMISSION_VIEW, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeFalse)
				So(canSave, ShouldBeFalse)
				So(canView, ShouldBeTrue)
			})

			teamWithPermissionScenario(m.PERMISSION_ADMIN, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeTrue)
				So(canEdit, ShouldBeTrue)
				So(canSave, ShouldBeTrue)
				So(canView, ShouldBeTrue)
			})

			teamWithPermissionScenario(m.PERMISSION_EDIT, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeTrue)
				So(canSave, ShouldBeTrue)
				So(canView, ShouldBeTrue)
			})

			teamWithPermissionScenario(m.PERMISSION_VIEW, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeFalse)
				So(canSave, ShouldBeFalse)
				So(canView, ShouldBeTrue)
			})

			Convey("When trying to update permissions should return false", func() {
				p := []*m.DashboardAcl{
					{OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_VIEW},
					{OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_ADMIN},
				}
				ok, _ := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
				So(ok, ShouldBeFalse)
			})
		})

		orgRoleScenario("Given user has viewer org role", m.ROLE_VIEWER, func(sc *scenarioContext) {
			everyoneWithRoleScenario(m.ROLE_EDITOR, m.PERMISSION_ADMIN, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeFalse)
				So(canSave, ShouldBeFalse)
				So(canView, ShouldBeFalse)
			})

			everyoneWithRoleScenario(m.ROLE_EDITOR, m.PERMISSION_EDIT, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeFalse)
				So(canSave, ShouldBeFalse)
				So(canView, ShouldBeFalse)
			})

			everyoneWithRoleScenario(m.ROLE_EDITOR, m.PERMISSION_VIEW, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeFalse)
				So(canSave, ShouldBeFalse)
				So(canView, ShouldBeFalse)
			})

			everyoneWithRoleScenario(m.ROLE_VIEWER, m.PERMISSION_ADMIN, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeTrue)
				So(canEdit, ShouldBeTrue)
				So(canSave, ShouldBeTrue)
				So(canView, ShouldBeTrue)
			})

			everyoneWithRoleScenario(m.ROLE_VIEWER, m.PERMISSION_EDIT, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeTrue)
				So(canSave, ShouldBeTrue)
				So(canView, ShouldBeTrue)
			})

			everyoneWithRoleScenario(m.ROLE_VIEWER, m.PERMISSION_VIEW, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeFalse)
				So(canSave, ShouldBeFalse)
				So(canView, ShouldBeTrue)
			})

			userWithPermissionScenario(m.PERMISSION_ADMIN, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeTrue)
				So(canEdit, ShouldBeTrue)
				So(canSave, ShouldBeTrue)
				So(canView, ShouldBeTrue)
			})

			userWithPermissionScenario(m.PERMISSION_EDIT, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeTrue)
				So(canSave, ShouldBeTrue)
				So(canView, ShouldBeTrue)
			})

			userWithPermissionScenario(m.PERMISSION_VIEW, sc, func(sc *scenarioContext) {
				canAdmin, _ := sc.g.CanAdmin()
				canEdit, _ := sc.g.CanEdit()
				canSave, _ := sc.g.CanSave()
				canView, _ := sc.g.CanView()
				So(canAdmin, ShouldBeFalse)
				So(canEdit, ShouldBeFalse)
				So(canSave, ShouldBeFalse)
				So(canView, ShouldBeTrue)
			})

			Convey("When trying to update permissions should return false", func() {
				p := []*m.DashboardAcl{
					{OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_VIEW},
					{OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_ADMIN},
				}
				ok, _ := sc.g.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, p)
				So(ok, ShouldBeFalse)
			})
		})
	})
}

type scenarioContext struct {
	g DashboardGuardian
}

type scenarioFunc func(c *scenarioContext)

func orgRoleScenario(desc string, role m.RoleType, fn scenarioFunc) {
	user := &m.SignedInUser{
		UserId:  1,
		OrgId:   1,
		OrgRole: role,
	}
	guard := New(1, 1, user)
	sc := &scenarioContext{
		g: guard,
	}

	Convey(desc, func() {
		fn(sc)
	})
}

func permissionScenario(desc string, sc *scenarioContext, permissions []*m.DashboardAclInfoDTO, fn scenarioFunc) {
	bus.ClearBusHandlers()

	bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
		query.Result = permissions
		return nil
	})

	teams := []*m.Team{}

	for _, p := range permissions {
		if p.TeamId > 0 {
			teams = append(teams, &m.Team{Id: p.TeamId})
		}
	}

	bus.AddHandler("test", func(query *m.GetTeamsByUserQuery) error {
		query.Result = teams
		return nil
	})

	Convey(desc, func() {
		fn(sc)
	})
}

func userWithPermissionScenario(permission m.PermissionType, sc *scenarioContext, fn scenarioFunc) {
	p := []*m.DashboardAclInfoDTO{
		{OrgId: 1, DashboardId: 1, UserId: 1, Permission: permission},
	}
	permissionScenario(fmt.Sprintf("and user has permission to %s item", permission), sc, p, fn)
}

func teamWithPermissionScenario(permission m.PermissionType, sc *scenarioContext, fn scenarioFunc) {
	p := []*m.DashboardAclInfoDTO{
		{OrgId: 1, DashboardId: 1, TeamId: 1, Permission: permission},
	}
	permissionScenario(fmt.Sprintf("and team has permission to %s item", permission), sc, p, fn)
}

func everyoneWithRoleScenario(role m.RoleType, permission m.PermissionType, sc *scenarioContext, fn scenarioFunc) {
	p := []*m.DashboardAclInfoDTO{
		{OrgId: 1, DashboardId: 1, UserId: -1, Role: &role, Permission: permission},
	}
	permissionScenario(fmt.Sprintf("and everyone with %s role can %s item", role, permission), sc, p, fn)
}
