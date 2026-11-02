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
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func snapshotOwnedBy(snap *dashv0.Snapshot, requester identity.Requester) bool {
	if !requester.IsIdentityType(authlib.TypeUser, authlib.TypeServiceAccount) {
		return false
	}
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
	// Legacy SQL and migrated snapshots identify creators by the internal user ID,
	// including service accounts stored in the legacy user table.
	id, err := requester.GetInternalID()
	return err == nil && id > 0 && creator == authlib.NewTypeID(authlib.TypeUser, strconv.FormatInt(id, 10))
}

// publicSnapshotGetContext delegates only the metadata read for an authorized public GET.
// Use the requested namespace rather than an untrusted caller or returned snapshot
// when selecting the storage key and the service identity.
func publicSnapshotGetContext(ctx context.Context) (context.Context, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	return identity.WithServiceIdentityForSingleNamespaceContext(ctx, ns.Value), nil
}

func snapshotLookupContext(ctx context.Context, name string) (context.Context, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	if requester.GetOrgID() != ns.OrgID {
		return nil, apierrors.NewNotFound(dashv0.SnapshotResourceInfo.GroupResource(), name)
	}
	// Administrative lookups must not require read access, but cannot cross orgs.
	lookupCtx := identity.WithServiceIdentityForSingleNamespaceContext(ctx, ns.Value)
	return identity.WithOriginalIdentityUID(lookupCtx, requester.GetUID()), nil
}

func authorizeSnapshotDelete(ctx context.Context, snap *dashv0.Snapshot, accessControl ac.AccessControl, blobs resourcepb.BlobStoreClient) error {
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
	if requester.GetOrgID() != ns.OrgID {
		return apierrors.NewNotFound(dashv0.SnapshotResourceInfo.GroupResource(), snap.Name)
	}
	allowed, err := accessControl.Evaluate(ctx, requester, ac.EvalPermission(dashboards.ActionSnapshotsDelete))
	if err != nil {
		return err
	}
	if !allowed {
		return apierrors.NewForbidden(dashv0.SnapshotResourceInfo.GroupResource(), snap.Name, errors.New("access denied"))
	}
	if snapshotOwnedBy(snap, requester) {
		return nil
	}

	// Deletion must not require snapshots:read or permission to read the blob.
	content, err := loadDashboardContent(identity.WithServiceIdentityForSingleNamespaceContext(ctx, snap.Namespace), blobs, snap)
	if err != nil {
		return err
	}
	dashboard := simplejson.NewFromAny(content)
	id := dashboard.Get("id").MustInt64()
	uid := dashboard.Get("uid").MustString()
	if id == 0 && uid == "" {
		return nil
	}
	var scope string
	if id != 0 {
		scope = dashboards.ScopeDashboardsProvider.GetResourceScope(strconv.FormatInt(id, 10))
	} else {
		scope = dashboards.ScopeDashboardsProvider.GetResourceScopeUID(uid)
	}
	allowed, err = accessControl.Evaluate(ctx, requester, ac.EvalPermission(dashboards.ActionDashboardsWrite, scope))
	if err != nil && !errors.Is(err, dashboards.ErrDashboardNotFound) {
		return err
	}
	if allowed || errors.Is(err, dashboards.ErrDashboardNotFound) {
		return nil
	}
	return apierrors.NewForbidden(dashv0.SnapshotResourceInfo.GroupResource(), snap.Name, errors.New("access denied to this snapshot"))
}
