package contracts

import (
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	secretv1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type SecureValueValidator interface {
	Validate(sv *secretv1.SecureValue, oldSv *secretv1.SecureValue, operation admission.Operation) field.ErrorList
}

type KeeperValidator interface {
	Validate(keeper *secretv1.Keeper, oldKeeper *secretv1.Keeper, operation admission.Operation) field.ErrorList
}

type ErrValidateSecureValue struct {
	list field.ErrorList
}

var _ xkube.ErrorLister = (*ErrValidateSecureValue)(nil)

func NewErrValidateSecureValue(list field.ErrorList) *ErrValidateSecureValue {
	return &ErrValidateSecureValue{list: list}
}

func (e *ErrValidateSecureValue) Error() string {
	return e.list.ToAggregate().Error()
}

func (e *ErrValidateSecureValue) ErrorList() field.ErrorList {
	return e.list
}
