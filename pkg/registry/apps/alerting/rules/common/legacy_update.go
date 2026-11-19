package common

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana-app-sdk/resource"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/convert"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/rules/legacy"
)

// LegacyRuleUpdate applies an update to a rule kept in legacy storage. With dryRun nothing is saved and the result is
// what the rule service would have stored.
func LegacyRuleUpdate[T resource.Object](
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	updateValidation rest.ValidateObjectUpdateFunc,
	dryRun bool,
	service *legacy.LegacyRuleService,
	namespacer request.NamespaceMapper,
	resourceInfo utils.ResourceInfo,
	get func(context.Context, string, *metav1.GetOptions) (runtime.Object, error),
	convertToDomainModel func(int64, T) (*ngmodels.AlertRule, utils.ManagerProperties, error),
	convertToK8sResource func(int64, *ngmodels.AlertRule, utils.ManagerProperties, request.NamespaceMapper) (T, error),
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

	rule, err := applyLegacyRuleUpdate(ctx, name, old, obj, dryRun, service, namespacer, resourceInfo, convertToDomainModel, convertToK8sResource)
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
	service *legacy.LegacyRuleService,
	namespacer request.NamespaceMapper,
	resourceInfo utils.ResourceInfo,
	get func(context.Context, string, *metav1.GetOptions) (runtime.Object, error),
	convertToDomainModel func(int64, T) (*ngmodels.AlertRule, utils.ManagerProperties, error),
	convertToK8sResource func(int64, *ngmodels.AlertRule, utils.ManagerProperties, request.NamespaceMapper) (T, error),
) (runtime.Object, error) {
	old, err := get(ctx, name, nil)
	if err != nil {
		return nil, err
	}
	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, err
	}
	if _, err := applyLegacyRuleUpdate(ctx, name, old, obj, true, service, namespacer, resourceInfo, convertToDomainModel, convertToK8sResource); err != nil {
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
	service *legacy.LegacyRuleService,
	namespacer request.NamespaceMapper,
	resourceInfo utils.ResourceInfo,
	convertToDomainModel func(int64, T) (*ngmodels.AlertRule, utils.ManagerProperties, error),
	convertToK8sResource func(int64, *ngmodels.AlertRule, utils.ManagerProperties, request.NamespaceMapper) (T, error),
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

	domainModel, managerProps, err := convertToDomainModel(info.OrgID, new)
	if err != nil {
		return nil, err
	}

	if err := setUpdatePreconditions(new, domainModel); err != nil {
		return nil, err
	}

	result, err := service.UpdateAlertRule(ctx, user, *domainModel, managerProps, dryRun)
	if err != nil {
		return nil, ToAPIError(resourceInfo.GroupResource(), name, err)
	}

	if dryRun {
		rule, err := convertToK8sResource(info.OrgID, &result, managerProps, namespacer)
		if err != nil {
			return nil, err
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

	updated, managerProps, err := service.GetAlertRule(ctx, user, name)
	if err != nil {
		return nil, ToAPIError(resourceInfo.GroupResource(), name, err)
	}

	return convertToK8sResource(info.OrgID, &updated, managerProps, namespacer)
}

func setUpdatePreconditions(meta metav1.Object, rule *ngmodels.AlertRule) error {
	if version := meta.GetResourceVersion(); version != "" {
		parsed, err := strconv.ParseInt(version, 10, 64)
		if err != nil || parsed <= 0 {
			return apierrors.NewBadRequest("metadata.resourceVersion must be a positive integer")
		}
		rule.Version = parsed
	}
	rule.GUID = string(meta.GetUID())
	return nil
}
