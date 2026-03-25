package contracts

import (
	secretv1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1"
	"k8s.io/apiserver/pkg/admission"
)

type SecureValueMutator interface {
	Mutate(sv *secretv1.SecureValue, operation admission.Operation) error
}

type KeeperMutator interface {
	Mutate(kp *secretv1.Keeper, operation admission.Operation) error
}
