package contracts

import (
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"k8s.io/apiserver/pkg/admission"
)

type SecureValueMutator interface {
	Mutate(sv *secretv1beta1.SecureValue, operation admission.Operation) error
}

type KeeperMutator interface {
	Mutate(kp *secretv1beta1.Keeper, operation admission.Operation) error
}
