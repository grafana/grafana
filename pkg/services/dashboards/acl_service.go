package dashboards

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"time"
)

func MakeUserAdmin(bus bus.Bus, orgId int64, userId int64, dashboardId int64, setViewAndEditPermissions bool) error {
	rtEditor := models.ROLE_EDITOR
	rtViewer := models.ROLE_VIEWER

	items := []*models.DashboardAcl{
		{
			OrgId:       orgId,
			DashboardId: dashboardId,
			UserId:      userId,
			Permission:  models.PERMISSION_ADMIN,
			Created:     time.Now(),
			Updated:     time.Now(),
		},
	}

	if setViewAndEditPermissions {
		items = append(items,
			&models.DashboardAcl{
				OrgId:       orgId,
				DashboardId: dashboardId,
				Role:        &rtEditor,
				Permission:  models.PERMISSION_EDIT,
				Created:     time.Now(),
				Updated:     time.Now(),
			},
			&models.DashboardAcl{
				OrgId:       orgId,
				DashboardId: dashboardId,
				Role:        &rtViewer,
				Permission:  models.PERMISSION_VIEW,
				Created:     time.Now(),
				Updated:     time.Now(),
			},
		)
	}

	aclCmd := &models.UpdateDashboardAclCommand{
		DashboardId: dashboardId,
		Items:       items,
	}

	if err := bus.Dispatch(aclCmd); err != nil {
		return err
	}

	return nil
}
