package dashboard

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"github.com/grafana/grafana/pkg/services/user"
	"k8s.io/client-go/dynamic"
)

var _ Watcher = (*watcher)(nil)

type watcher struct {
	enabled              bool
	log                  log.Logger
	dashboardResource    dynamic.ResourceInterface
	dashboardService     dashboards.DashboardService
	userService          user.Service
	accessControlService accesscontrol.Service
}

func ProvideWatcher(
	features featuremgmt.FeatureToggles,
	dashboardService *service.DashboardServiceImpl,
	userService user.Service,
	accessControlService accesscontrol.Service,
	clientSet *client.Clientset,
) (*watcher, error) {
	dashboardResource, err := clientSet.GetResourceClient(CRD)
	if err != nil {
		return nil, err
	}
	c := watcher{
		enabled:              features.IsEnabled(featuremgmt.FlagK8s),
		log:                  log.New("k8s.dashboards.controller"),
		dashboardService:     dashboardService,
		userService:          userService,
		accessControlService: accessControlService,
		dashboardResource:    dashboardResource,
	}
	return &c, nil
}

func (c *watcher) Add(ctx context.Context, obj *Dashboard) error {
	dto, err := k8sDashboardToDashboardDTO(obj)
	if err != nil {
		return err
	}

	if existing, err := c.dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{UID: dto.Dashboard.UID, OrgID: dto.OrgID}); err == nil && existing.Version >= dto.Dashboard.Version {
		return fmt.Errorf("dashboard already exists, skipping")
	}

	signedInUser, err := c.getSignedInUser(ctx, dto.OrgID, dto.Dashboard.UpdatedBy)
	if err != nil {
		return err
	}

	dto.User = signedInUser

	_, err = c.dashboardService.SaveDashboard(ctx, dto, true)
	if err != nil {
		return err
	}
	return nil
}

func (c *watcher) Update(ctx context.Context, oldObj, newObj *Dashboard) error {
	dto, err := k8sDashboardToDashboardDTO(newObj)
	if err != nil {
		return err
	}

	existing, err := c.dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{
		UID:   dto.Dashboard.UID,
		OrgID: dto.OrgID,
	})
	if err != nil {
		return err
	}
	rv := existing.Data.Get("resourceVersion").MustString()
	if rv == newObj.ResourceVersion {
		return fmt.Errorf("resourceVersion is already saved resourceVersion: %s", rv)
	}

	// Always overwrite
	dto.Overwrite = true

	signedInUser, err := c.getSignedInUser(ctx, dto.OrgID, dto.Dashboard.UpdatedBy)
	if err != nil {
		return err
	}

	dto.User = signedInUser

	_, err = c.dashboardService.SaveDashboard(ctx, dto, true)
	if err != nil {
		return err
	}
	return nil
}

func (c *watcher) Delete(ctx context.Context, obj *Dashboard) error {
	dto, err := k8sDashboardToDashboardDTO(obj)
	if err != nil {
		return fmt.Errorf("dashboard delete failed %w", err)
	}
	existing, err := c.dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{UID: dto.Dashboard.UID, OrgID: dto.OrgID})
	// no dashboard found, nothing to delete
	if err != nil {
		return nil
	}

	return c.dashboardService.DeleteDashboard(ctx, existing.ID, existing.OrgID)

}

// only run service if feature toggle is enabled
func (c *watcher) IsDisabled() bool {
	return !c.enabled
}

// TODO: get the admin user using userID 1 and orgID 1
// is this safe? probably not.
func (c *watcher) getSignedInUser(ctx context.Context, orgID int64, userID int64) (*user.SignedInUser, error) {
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
