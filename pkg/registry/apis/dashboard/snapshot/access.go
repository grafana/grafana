package snapshot

import (
	"context"
	"errors"
	"strconv"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/components/simplejson"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

func snapshotOwnedBy(snap *dashv0.Snapshot, requester identity.Requester) bool {
	if !requester.IsIdentityType(authlib.TypeUser, authlib.TypeServiceAccount) {
		return false
	}
	// Unified storage stamps the creator under grafana.app/createdBy; legacy conversions use the
	// generated grafana.com/createdBy accessor.
	creator := snap.Annotations[utils.AnnoKeyCreatedBy]
	if creator == "" {
		creator = snap.GetCreatedBy()
	}
	if creator == "" {
		return false
	}
	if creator == requester.GetUID() {
		return true
	}
	// Legacy SQL snapshots identify creators by the internal user ID.
	id, err := requester.GetInternalID()
	return err == nil && id > 0 && creator == authlib.NewTypeID(authlib.TypeUser, strconv.FormatInt(id, 10))
}

func authorizeSnapshotDelete(ctx context.Context, snap *dashv0.Snapshot, accessControl ac.AccessControl) error {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return err
	}
	if snap.Namespace != ns.Value {
		return apierrors.NewNotFound(dashv0.SnapshotResourceInfo.GroupResource(), snap.Name)
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	if snapshotOwnedBy(snap, requester) {
		return nil
	}

	dashboard := simplejson.NewFromAny(snap.Spec.Dashboard)
	id := dashboard.Get("id").MustInt64()
	uid := dashboard.Get("uid").MustString()
	// Same as legacy: a snapshot without a source dashboard (external or failed
	// creation) is only gated by snapshots:delete.
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
	return apierrors.NewForbidden(dashv0.SnapshotResourceInfo.GroupResource(), snap.Name, errors.New("access denied to this snapshot"))
}
