package snapshot

import (
	"context"
	"errors"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

func authorizeSnapshotDelete(ctx context.Context, snap *dashboardsnapshots.DashboardSnapshot, accessControl ac.AccessControl) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	if userID, err := requester.GetInternalID(); err == nil && userID > 0 && snap.UserID == userID {
		return nil
	}

	if snap.Dashboard == nil {
		return nil
	}
	id := snap.Dashboard.Get("id").MustInt64()
	uid := snap.Dashboard.Get("uid").MustString()
	if id == 0 && uid == "" {
		return nil
	}
	var scope string
	if id != 0 {
		scope = dashboards.ScopeDashboardsProvider.GetResourceScope(strconv.FormatInt(id, 10))
	} else {
		scope = dashboards.ScopeDashboardsProvider.GetResourceScopeUID(uid)
	}
	allowed, err := accessControl.Evaluate(ctx, requester, ac.EvalPermission(dashboards.ActionDashboardsWrite, scope))
	if err != nil && !errors.Is(err, dashboards.ErrDashboardNotFound) {
		return err
	}
	if allowed || errors.Is(err, dashboards.ErrDashboardNotFound) {
		return nil
	}
	return apierrors.NewForbidden(dashV0.SnapshotResourceInfo.GroupResource(), snap.Key, errors.New("access denied to this snapshot"))
}
