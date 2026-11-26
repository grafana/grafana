package common

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/resource"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/convert"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

// LegacyRuleUpdateFunc saves a rule through the legacy rule service, for example legacy.AlertRules.Update. With dryRun
// nothing is written and it returns the rule that would have been stored.
type LegacyRuleUpdateFunc[T resource.Object] func(ctx context.Context, user identity.Requester, orgID int64, rule T, dryRun bool) (T, error)

// LegacyRuleUpdate applies an update to a rule kept in legacy storage. With dryRun nothing is saved and the result is
// what the rule service would have stored.
func LegacyRuleUpdate[T resource.Object](
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	updateValidation rest.ValidateObjectUpdateFunc,
	dryRun bool,
	resourceInfo utils.ResourceInfo,
	get func(context.Context, string, *metav1.GetOptions) (runtime.Object, error),
	update LegacyRuleUpdateFunc[T],
) (runtime.Object, bool, error) {
	old, err := get(ctx, name, nil)
	if err != nil {
		return old, false, err
	}

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, false, err
	}
	if updateValidation != nil {
		if err := updateValidation(ctx, obj, old); err != nil {
			return nil, false, err
		}
	}

	rule, err := applyLegacyRuleUpdate(ctx, name, old, obj, dryRun, resourceInfo, update)
	if err != nil {
		return nil, false, err
	}
	return rule, false, nil
}

// LegacyRulePrepareDryRunUpdate implements dualwrite.DryRunUpdatePreparer for a rule kept in legacy storage. It applies
// the request to the stored rule and checks the result with the rule service, without writing it. The dual writer then
// simulates the update in unified storage, which runs admission but knows nothing of the rule service's own checks.
func LegacyRulePrepareDryRunUpdate[T resource.Object](
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	resourceInfo utils.ResourceInfo,
	get func(context.Context, string, *metav1.GetOptions) (runtime.Object, error),
	update LegacyRuleUpdateFunc[T],
) (runtime.Object, error) {
	old, err := get(ctx, name, nil)
	if err != nil {
		return nil, err
	}
	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, err
	}
	if _, err := applyLegacyRuleUpdate(ctx, name, old, obj, true, resourceInfo, update); err != nil {
		return nil, err
	}
	return obj, nil
}

// applyLegacyRuleUpdate saves obj, the new version of the stored rule old, and returns the stored result.
func applyLegacyRuleUpdate[T resource.Object](
	ctx context.Context,
	name string,
	old, obj runtime.Object,
	dryRun bool,
	resourceInfo utils.ResourceInfo,
	update LegacyRuleUpdateFunc[T],
) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	new, err := convert.Hub[T](obj)
	if err != nil {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected valid %s object", resourceInfo.GroupVersionKind().Kind))
	}

	rule, err := update(ctx, user, info.OrgID, new, dryRun)
	if err != nil {
		return nil, ToAPIError(resourceInfo.GroupResource(), name, err)
	}
	if !dryRun {
		return rule, nil
	}

	stored, err := convert.Hub[T](old)
	if err != nil {
		return nil, err
	}
	// Nothing was written, so the stored identity, version and status still hold.
	rule.SetUID(stored.GetUID())
	rule.SetResourceVersion(stored.GetResourceVersion())
	if status, ok := stored.GetSubresource(string(resource.SubresourceStatus)); ok {
		if err := rule.SetSubresource(string(resource.SubresourceStatus), status); err != nil {
			return nil, err
		}
	}
	return rule, nil
}
