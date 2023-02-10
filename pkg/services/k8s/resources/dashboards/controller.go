package dashboards

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/informer"
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

func ProvideController(
	features featuremgmt.FeatureToggles,
	dashboardService *service.DashboardServiceImpl,
	userService user.Service,
	accessControlService accesscontrol.Service,
	dashboardResource *Resource,
	informerFactory *informer.Factory,
) *Controller {
	c := Controller{
		enabled:              features.IsEnabled(featuremgmt.FlagK8s),
		log:                  log.New("k8s.dashboards.controller"),
		dashboardService:     dashboardService,
		userService:          userService,
		accessControlService: accessControlService,
		dashboardResource:    dashboardResource,
	}
	informerFactory.AddInformer(c.dashboardResource.crd, &c)
	return &c
}

func (c *Controller) OnAdd(ctx context.Context, obj any) {
	dash, err := interfaceToK8sDashboard(obj)
	if err != nil {
		c.log.Error("dashboard add failed", err)
		return
	}

	dto, err := k8sDashboardToDashboardDTO(dash)
	if err != nil {
		c.log.Error("dashboard add failed", "err", err)
	}

	if existing, err := c.dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{UID: dto.Dashboard.UID, OrgID: dto.OrgID}); err == nil && existing.Version >= dto.Dashboard.Version {
		c.log.Error("dashboard already exists, skipping")
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

func (c *Controller) OnUpdate(ctx context.Context, oldObj, newObj any) {
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
	rv := existing.Data.Get("resourceVersion").MustString()
	if rv == dash.ResourceVersion {
		c.log.Error("resourceVersion is already saved", "resourceVersion", rv)
		return
	}

	// Always overwrite
	dto.Overwrite = true

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

func (c *Controller) OnDelete(ctx context.Context, obj any) {
	dash, err := interfaceToK8sDashboard(obj)
	if err != nil {
		c.log.Error("dashboard delete failed", err)
		return
	}
	dto, err := k8sDashboardToDashboardDTO(dash)
	if err != nil {
		c.log.Error("dashboard delete failed", "err", err)
	}
	existing, err := c.dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{UID: dto.Dashboard.UID, OrgID: dto.OrgID})
	// no dashboard found, nothing to delete
	if err != nil {
		return
	}

	if err := c.dashboardService.DeleteDashboard(ctx, existing.ID, existing.OrgID); err != nil {
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
