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

func LegacyRuleUpdate[T resource.Object](
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	updateValidation rest.ValidateObjectUpdateFunc,
	service *legacy.LegacyRuleService,
	namespacer request.NamespaceMapper,
	resourceInfo utils.ResourceInfo,
	get func(context.Context, string, *metav1.GetOptions) (runtime.Object, error),
	convertToDomainModel func(int64, T) (*ngmodels.AlertRule, utils.ManagerProperties, error),
	convertToK8sResource func(int64, *ngmodels.AlertRule, utils.ManagerProperties, request.NamespaceMapper) (T, error),
) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

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

	new, err := convert.Hub[T](obj)
	if err != nil {
		return nil, false, apierrors.NewBadRequest(fmt.Sprintf("expected valid %s object", resourceInfo.GroupVersionKind().Kind))
	}

	domainModel, managerProps, err := convertToDomainModel(info.OrgID, new)
	if err != nil {
		return old, false, err
	}

	if err := setUpdatePreconditions(new, domainModel); err != nil {
		return nil, false, err
	}

	_, err = service.UpdateAlertRule(ctx, user, *domainModel, managerProps)
	if err != nil {
		return nil, false, ToAPIError(resourceInfo.GroupResource(), name, err)
	}

	updated, managerProps, err := service.GetAlertRule(ctx, user, name)
	if err != nil {
		return nil, false, ToAPIError(resourceInfo.GroupResource(), name, err)
	}

	rule, err := convertToK8sResource(info.OrgID, &updated, managerProps, namespacer)
	if err != nil {
		return nil, false, err
	}

	return rule, false, nil
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
