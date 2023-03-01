package dashboard

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
)

var _ Watcher = (*watcher)(nil)

type watcher struct {
	enabled              bool
	log                  log.Logger
	dashboardStore       database.DashboardSQLStore
	userService          user.Service
	accessControlService accesscontrol.Service
}

func ProvideWatcher(
	features featuremgmt.FeatureToggles,
	dashboardStore database.DashboardSQLStore,
	userService user.Service,
	accessControlService accesscontrol.Service,
) (*watcher, error) {
	c := watcher{
		enabled:              features.IsEnabled(featuremgmt.FlagK8s),
		log:                  log.New("k8s.dashboards.controller"),
		dashboardStore:       dashboardStore,
		userService:          userService,
		accessControlService: accessControlService,
	}
	return &c, nil
}

func (c *watcher) Add(ctx context.Context, obj *Dashboard) error {
	c.log.Debug("adding dashboard", "obj", obj)
	cmd, err := k8sDashboardToDashboardCommand(obj)
	if err != nil {
		return err
	}

	if _, err := c.dashboardStore.GetDashboard(ctx, &dashboards.GetDashboardQuery{
		UID:   cmd.Dashboard.MustString("uid"),
		OrgID: cmd.OrgID,
	}); err == nil { //&& existing.Version >= dto.Dashboard.Version {
		c.log.Debug("dashboard already exists, skipping")
		return nil
	}

	// signedInUser, err := c.getSignedInUser(ctx, dto.OrgID, dto.Dashboard.UpdatedBy)
	// if err != nil {
	// 	return err
	// }

	// dto.User = signedInUser

	_, err = c.dashboardStore.SaveDashboard(ctx, cmd)
	return err
}

func (c *watcher) Update(ctx context.Context, oldObj, newObj *Dashboard) error {
	cmd, err := k8sDashboardToDashboardCommand(newObj)
	if err != nil {
		return err
	}

	existing, err := c.dashboardStore.GetDashboard(ctx, &dashboards.GetDashboardQuery{
		UID:   cmd.Dashboard.MustString("uid"),
		OrgID: cmd.OrgID,
	})
	if err != nil {
		return err
	}
	rv := existing.Data.Get("resourceVersion").MustString()
	if rv == newObj.ResourceVersion {
		c.log.Debug("dashboard already exists, skipping")
		return nil
	}

	// Always overwrite
	cmd.Overwrite = true

	// signedInUser, err := c.getSignedInUser(ctx, dto.OrgID, dto.Dashboard.UpdatedBy)
	// if err != nil {
	// 	return err
	// }

	// cmd.User = signedInUser

	_, err = c.dashboardStore.SaveDashboard(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (c *watcher) Delete(ctx context.Context, obj *Dashboard) error {
	cmd, err := k8sDashboardToDashboardCommand(obj)
	if err != nil {
		return err
	}
	existing, err := c.dashboardStore.GetDashboard(ctx, &dashboards.GetDashboardQuery{
		UID:   cmd.Dashboard.MustString("uid"),
		OrgID: cmd.OrgID,
	})
	// no dashboard found, nothing to delete
	if err != nil {
		return nil
	}

	return c.dashboardStore.DeleteDashboard(ctx, &dashboards.DeleteDashboardCommand{
		ID:    existing.ID,
		OrgID: existing.OrgID,
	})
}

// only run service if feature toggle is enabled
func (c *watcher) IsDisabled() bool {
	return !c.enabled
}

// TODO: get the admin user using userID 1 and orgID 1
// is this safe? probably not.
func (c *watcher) GGGetSignedInUser(ctx context.Context, orgID int64, userID int64) (*user.SignedInUser, error) {
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
