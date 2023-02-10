package dashboards

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"github.com/grafana/grafana/pkg/services/user"
)

type Controller struct {
	enabled              bool
	log                  log.Logger
	dashboardResource    *Resource
	dashboardService     dashboards.DashboardService
	userService          user.Service
	accessControlService accesscontrol.Service
}

var _ client.Watcher = (*Controller)(nil)

func ProvideController(features featuremgmt.FeatureToggles, userService user.Service, accessControlService accesscontrol.Service, dashboardResource *Resource) *Controller {
	return &Controller{
		enabled:              features.IsEnabled(featuremgmt.FlagK8s),
		log:                  log.New("k8s.dashboards.controller"),
		userService:          userService,
		accessControlService: accessControlService,
		dashboardResource:    dashboardResource,
	}
}

func (c *Controller) WithDashboardService(dashboardService dashboards.DashboardService) *Controller {
	c.dashboardService = dashboardService
	return c
}

func (c *Controller) Run(ctx context.Context) error {
	c.dashboardResource.RegisterController(ctx, c)
	<-ctx.Done()
	return nil
}

func (c *Controller) OnAdd(obj interface{}) {
	dash, err := interfaceToK8sDashboard(obj)
	if err != nil {
		c.log.Error("dashboard add failed", err)
		return
	}

	dto, err := k8sDashboardToDashboardDTO(dash)
	if err != nil {
		c.log.Error("dashboard add failed", "err", err)
	}

	if existing, err := c.dashboardService.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{UID: dto.Dashboard.UID, OrgID: dto.OrgID}); err == nil && existing.Version >= dto.Dashboard.Version {
		c.log.Error("dashboard already exists, skipping")
		return
	}

	signedInUser, err := c.getSignedInUser(context.Background(), dto.OrgID, dto.Dashboard.UpdatedBy)
	if err != nil {
		c.log.Error("orig.SaveDashboard failed", err)
	}

	dto.User = signedInUser

	_, err = c.dashboardService.SaveDashboard(context.Background(), dto, true)
	if err != nil {
		c.log.Error("orig.SaveDashboard failed", err)
		return
	}
}

func (c *Controller) OnUpdate(oldObj, newObj interface{}) {
	ctx := context.Background()
	dash, err := interfaceToK8sDashboard(newObj)
	if err != nil {
		c.log.Error("dashboard add failed", err)
		return
	}

	dto, err := k8sDashboardToDashboardDTO(dash)
	if err != nil {
		c.log.Error("dashboard update failed", "err", err)
	}

	existing, err := c.dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{
		UID:   dto.Dashboard.UID,
		OrgID: dto.OrgID,
	})
	if err != nil {
		c.log.Error("get existing dashboard failed", "err", err)
	}
	if existing.Version > dto.Dashboard.Version {
		c.log.Error("existing dashboard is newer than requested, skipping", "existing", existing.Version, "requested", dto.Dashboard.Version)
		return
	}

	signedInUser, err := c.getSignedInUser(ctx, dto.OrgID, dto.Dashboard.UpdatedBy)
	if err != nil {
		c.log.Error("orig.SaveDashboard failed", err)
	}

	dto.User = signedInUser

	_, err = c.dashboardService.SaveDashboard(ctx, dto, true)
	if err != nil {
		c.log.Error("orig.SaveDashboard failed", err)
		return
	}
}

func (c *Controller) OnDelete(obj interface{}) {
	dash, err := interfaceToK8sDashboard(obj)
	if err != nil {
		c.log.Error("dashboard delete failed", err)
		return
	}
	dto, err := k8sDashboardToDashboardDTO(dash)
	if err != nil {
		c.log.Error("dashboard delete failed", "err", err)
	}
	existing, err := c.dashboardService.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{UID: dto.Dashboard.UID, OrgID: dto.OrgID})
	// no dashboard found, nothing to delete
	if err != nil {
		return
	}

	if err := c.dashboardService.DeleteDashboard(context.Background(), existing.ID, existing.OrgID); err != nil {
		c.log.Error("orig.DeleteDashboard failed", err)
	}
	c.log.Debug("dashboard deleted")
}

// only run service if feature toggle is enabled
func (c *Controller) IsDisabled() bool {
	return !c.enabled
}

// TODO: get the admin user using userID 1 and orgID 1
// is this safe? probably not.
func (c *Controller) getSignedInUser(ctx context.Context, orgID int64, userID int64) (*user.SignedInUser, error) {
	querySignedInUser := user.GetSignedInUserQuery{UserID: 1, OrgID: 1}
	signedInUser, err := c.userService.GetSignedInUserWithCacheCtx(ctx, &querySignedInUser)
	if err != nil {
		return nil, err
	}

	if signedInUser.Permissions == nil {
		signedInUser.Permissions = make(map[int64]map[string][]string)
	}

	if signedInUser.Permissions[signedInUser.OrgID] == nil {
		permissions, err := c.accessControlService.GetUserPermissions(ctx, signedInUser, accesscontrol.Options{})
		if err != nil {
			return nil, err
		}
		signedInUser.Permissions[signedInUser.OrgID] = accesscontrol.GroupScopesByAction(permissions)
	}

	return signedInUser, nil
}
