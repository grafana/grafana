package dashboards

import (
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/services/guardian"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"

	. "github.com/smartystreets/goconvey/convey"
)

func TestDashboardRepository(t *testing.T) {
	repo := DashboardRepository{}

	Convey("Validate create/update dashboard", t, func() {
		bus.ClearBusHandlers()
		dto := &SaveDashboardDTO{}

		Convey("Should return validation error for empty titles", func() {
			titles := []string{"", " ", "   \t   "}

			for _, title := range titles {
				dto.Dashboard = m.NewDashboard(title)
				_, err := repo.SaveDashboard(dto)
				So(err, ShouldEqual, m.ErrDashboardTitleEmpty)
			}
		})

		Convey("Should return validation error if it's a folder and have a folder id", func() {
			dto.Dashboard = m.NewDashboardFolder("Folder")
			dto.Dashboard.FolderId = 1
			_, err := repo.SaveDashboard(dto)
			So(err, ShouldEqual, m.ErrDashboardFolderCannotHaveParent)
		})

		Convey("Should return validation error if folder is named General", func() {
			dto.Dashboard = m.NewDashboardFolder("General")
			_, err := repo.SaveDashboard(dto)
			So(err, ShouldEqual, m.ErrDashboardFolderNameExists)
		})

		Convey("Should return validation error if alert data is invalid", func() {
			bus.AddHandler("test", func(cmd *alerting.ValidateDashboardAlertsCommand) error {
				return errors.New("error")
			})

			dto.Dashboard = m.NewDashboard("Dash")
			_, err := repo.SaveDashboard(dto)
			So(err, ShouldEqual, m.ErrDashboardContainsInvalidAlertData)
		})
	})

	Convey("Validation dashboard for update", t, func() {
		bus.ClearBusHandlers()
		bus.AddHandler("test", func(cmd *alerting.ValidateDashboardAlertsCommand) error {
			return nil
		})

		permissionToSaveDashboardScenario(func(sc *dashboardGuardianScenarioContext) {
			Convey("When validate dashboard for update returns error", func() {
				dash := m.NewDashboard("Dash")
				dash.Id = 1
				dash.Uid = "dash"

				bus.AddHandler("test", func(cmd *m.ValidateDashboardForUpdateCommand) error {
					return m.ErrDashboardNotFound
				})

				dto := &SaveDashboardDTO{
					Dashboard: m.NewDashboard("Dash"),
				}
				_, err := repo.SaveDashboard(dto)

				Convey("Should return error", func() {
					So(err, ShouldEqual, m.ErrDashboardNotFound)
				})

				Convey("Should not call guardian", func() {
					So(sc.dashboardGuardianMock.canSaveCallCounter, ShouldEqual, 0)
				})
			})
		})

		noPermissionToSaveDashboardScenario(func(sc *dashboardGuardianScenarioContext) {
			dash := m.NewDashboard("Dash")
			dash.Id = 1
			dash.Uid = "dash"

			bus.AddHandler("test", func(cmd *m.ValidateDashboardForUpdateCommand) error {
				cmd.Dashboard.Id = dash.Id
				return nil
			})

			dto := &SaveDashboardDTO{
				Dashboard: m.NewDashboard("Dash"),
			}
			_, err := repo.SaveDashboard(dto)

			Convey("Should return access denied error", func() {
				So(err, ShouldEqual, m.ErrDashboardUpdateAccessDenied)
			})

			Convey("Should call guardian with correct dashboard id", func() {
				So(sc.dashboardGuardianMock.canSaveCallCounter, ShouldEqual, 1)
				So(sc.dashboardGuardianMock.dashId, ShouldEqual, dash.Id)
			})
		})
	})

	// Convey("Get existing dashboard for update", t, func() {
	// 	bus.ClearBusHandlers()
	// 	bus.AddHandler("test", func(cmd *alerting.ValidateDashboardAlertsCommand) error {
	// 		return nil
	// 	})
	// 	bus.AddHandler("test", func(cmd *alerting.UpdateDashboardAlertsCommand) error {
	// 		return nil
	// 	})

	// 	var inMemDashboards []*m.Dashboard

	// 	savedFolder := m.NewDashboardFolder("Folder 1")
	// 	savedFolder.Id = 2
	// 	savedFolder.Uid = "folder1"
	// 	inMemDashboards = append(inMemDashboards, savedFolder)

	// 	savedDash := m.NewDashboard("Dash 2")
	// 	savedDash.Id = 1
	// 	savedDash.Uid = "dash2"
	// 	savedDash.FolderId = savedFolder.Id
	// 	inMemDashboards = append(inMemDashboards, savedDash)

	// 	getDashboardQueryById := m.GetDashboardQuery{}
	// 	getDashboardQueryByUid := m.GetDashboardQuery{}

	// 	bus.AddHandler("test", func(query *m.GetDashboardQuery) error {
	// 		for _, d := range inMemDashboards {
	// 			if query.Id > 0 && d.Id == query.Id {
	// 				query.Result = d
	// 				getDashboardQueryById.Result = d
	// 			}
	// 			if len(query.Uid) > 0 && d.Uid == query.Uid {
	// 				query.Result = d
	// 				getDashboardQueryByUid.Result = d
	// 			}
	// 		}

	// 		if query.Result == nil {
	// 			return m.ErrDashboardNotFound
	// 		}

	// 		return nil
	// 	})

	// 	var saveDashboardCmd *m.SaveDashboardCommand

	// 	bus.AddHandler("test", func(cmd *m.SaveDashboardCommand) error {
	// 		saveDashboardCmd = cmd
	// 		return nil
	// 	})

	// 	dto := SaveDashboardDTO{
	// 		User: &m.SignedInUser{
	// 			UserId: 1,
	// 		},
	// 	}

	// 	Convey("Should return not found error when trying to save a dashboard using non-existing id and uid", func() {
	// 		dash := m.NewDashboard("Dash")
	// 		dash.Id = 1000
	// 		dash.Uid = "non-existing"
	// 		item.Dashboard = dash

	// 		_, err := repo.SaveDashboard(&item)
	// 		expected := m.Errors.NotFound(m.ErrDashboardNotFound)
	// 		soNotFoundErrorShouldEqual(err, expected)
	// 	})

	// 	permissionToSaveDashboardScenario(func(sc *dashboardGuardianScenarioContext) {
	// 		Convey("Should populate uid from existing when updating dashboard and providing id without uid", func() {
	// 			dash := m.NewDashboard("Dash")
	// 			dash.Id = savedDash.Id
	// 			item.Dashboard = dash

	// 			repo.SaveDashboard(&item)
	// 			model := saveDashboardCmd.GetDashboardModel()
	// 			So(model.Uid, ShouldEqual, savedDash.Uid)
	// 		})
	// 	})

	// 	Convey("Should return validation error when trying to overwrite folder with dashboard using id", func() {
	// 		dash := m.NewDashboard("Dash")
	// 		dash.Id = savedFolder.Id
	// 		item.Dashboard = dash
	// 		item.Overwrite = true

	// 		_, err := repo.SaveDashboard(&item)
	// 		soValidationErrorShouldEqual(err, m.ErrDashboardTypeMismatch)
	// 	})

	// 	Convey("Should return validation error when trying to overwrite dashboard with folder using id", func() {
	// 		dash := m.NewDashboardFolder("Folder")
	// 		dash.Id = savedDash.Id
	// 		item.Dashboard = dash
	// 		item.Overwrite = true

	// 		_, err := repo.SaveDashboard(&item)
	// 		soValidationErrorShouldEqual(err, m.ErrDashboardTypeMismatch)
	// 	})

	// 	Convey("Should return validation error when trying to overwrite folder with dashboard using uid", func() {
	// 		dash := m.NewDashboard("Dash")
	// 		dash.Uid = savedFolder.Uid
	// 		item.Dashboard = dash
	// 		item.Overwrite = true

	// 		_, err := repo.SaveDashboard(&item)
	// 		soValidationErrorShouldEqual(err, m.ErrDashboardTypeMismatch)
	// 	})

	// 	Convey("Should return validation error when trying to overwrite dashboard with folder using uid", func() {
	// 		dash := m.NewDashboardFolder("Folder")
	// 		dash.Uid = savedDash.Uid
	// 		item.Dashboard = dash
	// 		item.Overwrite = true

	// 		_, err := repo.SaveDashboard(&item)
	// 		soValidationErrorShouldEqual(err, m.ErrDashboardTypeMismatch)
	// 	})
	// })

	// Convey("Create new dashboard", t, func() {
	// 	bus.ClearBusHandlers()
	// 	bus.AddHandler("test", func(cmd *alerting.ValidateDashboardAlertsCommand) error {
	// 		return nil
	// 	})
	// 	bus.AddHandler("test", func(cmd *alerting.UpdateDashboardAlertsCommand) error {
	// 		return nil
	// 	})

	// 	Convey("Given new dashboard without id and uid with general folder selected", func() {
	// 		newDash := m.NewDashboard("New dashboard")
	// 		newDash.IsFolder = false
	// 		newDash.FolderId = 0

	// 		// Convey("And non-existing title in folder", func() {
	// 		// 	newDash := m.NewDashboard("New dashboard")
	// 		// })
	// 	})
	// })
}

func mockDashboardGuardian(mock *mockDashboardGuarder) {
	guardian.NewDashboardGuardian = func(dashId int64, orgId int64, user *m.SignedInUser) guardian.IDashboardGuardian {
		mock.orgId = orgId
		mock.dashId = dashId
		mock.user = user
		return mock
	}
}

type mockDashboardGuarder struct {
	dashId                      int64
	orgId                       int64
	user                        *m.SignedInUser
	canSave                     bool
	canSaveCallCounter          int
	canEdit                     bool
	canView                     bool
	canAdmin                    bool
	hasPermission               bool
	checkPermissionBeforeRemove bool
	checkPermissionBeforeUpdate bool
}

func (g *mockDashboardGuarder) CanSave() (bool, error) {
	g.canSaveCallCounter++
	return g.canSave, nil
}

func (g *mockDashboardGuarder) CanEdit() (bool, error) {
	return g.canEdit, nil
}

func (g *mockDashboardGuarder) CanView() (bool, error) {
	return g.canView, nil
}

func (g *mockDashboardGuarder) CanAdmin() (bool, error) {
	return g.canAdmin, nil
}

func (g *mockDashboardGuarder) HasPermission(permission m.PermissionType) (bool, error) {
	return g.hasPermission, nil
}

func (g *mockDashboardGuarder) CheckPermissionBeforeRemove(permission m.PermissionType, aclIdToRemove int64) (bool, error) {
	return g.checkPermissionBeforeRemove, nil
}

func (g *mockDashboardGuarder) CheckPermissionBeforeUpdate(permission m.PermissionType, updatePermissions []*m.DashboardAcl) (bool, error) {
	return g.checkPermissionBeforeUpdate, nil
}

func (g *mockDashboardGuarder) GetAcl() ([]*m.DashboardAclInfoDTO, error) {
	return nil, nil
}

type dashboardGuardianScenarioContext struct {
	dashboardGuardianMock *mockDashboardGuarder
}

type dashboardGuardianScenarioFunc func(c *dashboardGuardianScenarioContext)

func noPermissionToSaveDashboardScenario(fn dashboardGuardianScenarioFunc) {
	mock := &mockDashboardGuarder{
		canSave: false,
	}
	dashboardGuardianScenario("Given user has no permission to save", mock, fn)
}

func permissionToSaveDashboardScenario(fn dashboardGuardianScenarioFunc) {
	mock := &mockDashboardGuarder{
		canSave: true,
	}
	dashboardGuardianScenario("Given user has permission to save", mock, fn)
}

func dashboardGuardianScenario(desc string, mock *mockDashboardGuarder, fn dashboardGuardianScenarioFunc) {
	Convey(desc, func() {
		origNewDashboardGuardian := guardian.NewDashboardGuardian
		mockDashboardGuardian(mock)

		sc := &dashboardGuardianScenarioContext{
			dashboardGuardianMock: mock,
		}

		defer func() {
			guardian.NewDashboardGuardian = origNewDashboardGuardian
		}()

		fn(sc)
	})
}
