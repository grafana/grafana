package dashboard

import (
	"context"
	"fmt"
	"strconv"

	"github.com/open-feature/go-sdk/openfeature"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	claims "github.com/grafana/authlib/types"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// Dashboard drafts and forks.
//
// A draft is a dashboard that exists but is not published yet. A fork is a private
// working copy of a published dashboard that is merged back explicitly. Both carry
// the grafana.app/lifecycle label and an owner label set by the server, and both are
// hidden from everyone except their owner and org admins (see lifecycleGuard).
//
// The feature flag gates creating drafts and forks and the lifecycle subresources.
// Visibility, label preservation, and cleanup act on the labels regardless of the
// flag, so turning the flag off never exposes leftover drafts.

func draftsAndForksEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagAssistantDashboardArtifactsDraftsAndForks, false, openfeature.TransactionContext(ctx))
}

// lifecycleOf returns the lifecycle state of a dashboard; published when unset.
func lifecycleOf(obj utils.GrafanaMetaAccessor) string {
	switch v := obj.GetLabels()[utils.LabelKeyLifecycle]; v {
	case utils.LifecycleDraft, utils.LifecycleFork:
		return v
	default:
		return utils.LifecyclePublished
	}
}

func isPrivateLifecycle(obj utils.GrafanaMetaAccessor) bool {
	return lifecycleOf(obj) != utils.LifecyclePublished
}

// lifecycleOwnerID is the label value identifying the requester as an owner.
// Only users and service accounts can own drafts and forks.
func lifecycleOwnerID(user identity.Requester) (string, error) {
	if !user.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		return "", apierrors.NewForbidden(dashv1.DashboardResourceInfo.GroupResource(), "", fmt.Errorf("only users and service accounts can own dashboard drafts and forks"))
	}
	id := user.GetIdentifier()
	if id == "" {
		return "", fmt.Errorf("requester has no identifier")
	}
	return id, nil
}

// canAccessPrivateLifecycle reports whether the requester may see a draft or fork:
// its owner, org admins, server admins, and Grafana's own service identity.
func canAccessPrivateLifecycle(ctx context.Context, obj utils.GrafanaMetaAccessor) bool {
	if !isPrivateLifecycle(obj) {
		return true
	}
	if identity.IsServiceIdentity(ctx) {
		return true
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return false
	}
	if user.GetIsGrafanaAdmin() || user.GetOrgRole() == identity.RoleAdmin {
		return true
	}
	if !user.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		return false
	}
	owner := obj.GetLabels()[utils.LabelKeyLifecycleOwner]
	return owner != "" && owner == user.GetIdentifier()
}

func canAccessPrivateLifecycleObject(ctx context.Context, obj runtime.Object) bool {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return true
	}
	return canAccessPrivateLifecycle(ctx, meta)
}

func forkBaseOf(obj utils.GrafanaMetaAccessor) (int64, bool) {
	v, ok := obj.GetAnnotations()[utils.AnnoKeyForkBase]
	if !ok {
		return 0, false
	}
	base, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return 0, false
	}
	return base, true
}

// serverOwnedLifecycleLabels are the labels only the server may set.
var serverOwnedLifecycleLabels = []string{utils.LabelKeyLifecycle, utils.LabelKeyLifecycleOwner, utils.LabelKeyForkOf}

// serverOwnedLifecycleAnnotations are the annotations only the server may set.
var serverOwnedLifecycleAnnotations = []string{utils.AnnoKeyForkBase}
