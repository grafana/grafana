package common

import (
	"errors"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
)

func ToAPIError(resource schema.GroupResource, name string, err error) error {
	switch {
	case errors.Is(err, rulestore.ErrOptimisticLock):
		return apierrors.NewConflict(resource, name, err)
	case errors.Is(err, ngmodels.ErrAlertRuleFailedValidation):
		return apierrors.NewBadRequest(err.Error())
	case errors.Is(err, ngmodels.ErrQuotaReached):
		return apierrors.NewForbidden(resource, name, err)
	case errors.Is(err, ngmodels.ErrAlertRuleNotFound):
		return apierrors.NewNotFound(resource, name)
	default:
		return err
	}
}
