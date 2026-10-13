package dashboard

import (
	"context"
	"fmt"

	"github.com/open-feature/go-sdk/openfeature"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	claims "github.com/grafana/authlib/types"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// Dashboard drafts.
//
// A draft is a dashboard that exists but is not published yet. It carries the
// grafana.app/lifecycle label and an owner label set by the server, and is hidden from
// everyone except its owner and org admins (see lifecycleGuard). Pending changes to a
// published dashboard are not stored in Grafana: the client that proposed them keeps
// them, and applying them is a regular dashboard save.
//
// The feature flag gates creating drafts and the lifecycle subresources. Visibility, label preservation, and cleanup act regardless of the flag,
// so turning the flag off never exposes leftover drafts.

func draftsEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagDashboardDrafts, false, openfeature.TransactionContext(ctx))
}

// lifecycleOf returns the lifecycle state of a dashboard; published when unset.
func lifecycleOf(obj utils.GrafanaMetaAccessor) string {
	switch v := obj.GetLabels()[utils.LabelKeyLifecycle]; v {
	case "", utils.LifecyclePublished:
		return utils.LifecyclePublished
	default:
		return v
	}
}

// isPrivateLifecycle reports a draft, or a dashboard with any other unpublished
// lifecycle value: an unknown value stays private rather than becoming visible to all.
func isPrivateLifecycle(obj utils.GrafanaMetaAccessor) bool {
	return lifecycleOf(obj) != utils.LifecyclePublished
}

// lifecycleOwnerID is the label value identifying the requester as an owner.
// Only users and service accounts can own drafts.
func lifecycleOwnerID(user identity.Requester) (string, error) {
	if !user.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		return "", apierrors.NewForbidden(dashv1.DashboardResourceInfo.GroupResource(), "", fmt.Errorf("only users and service accounts can own dashboard drafts"))
	}
	id := user.GetIdentifier()
	if id == "" {
		return "", fmt.Errorf("requester has no identifier")
	}
	return id, nil
}

// canAccessPrivateLifecycle reports whether the requester may see a draft:
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

// serverOwnedLifecycleLabels are the labels only the server may set.
var serverOwnedLifecycleLabels = []string{utils.LabelKeyLifecycle, utils.LabelKeyLifecycleOwner}
