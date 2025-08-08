package mutator

import (
	"cmp"
	"fmt"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/util"
	"k8s.io/apiserver/pkg/admission"
)

type keeperMutator struct{}

var _ contracts.KeeperMutator = &keeperMutator{}

func ProvideKeeperMutator() contracts.KeeperMutator {
	return &keeperMutator{}
}

func (*keeperMutator) Mutate(kp *secretv1beta1.Keeper, operation admission.Operation) error {
	if kp == nil {
		return fmt.Errorf("expected Keeper to be non-nil")
	}

	if operation == admission.Create && kp.Name == "" {
		kp.SetName(cmp.Or(kp.GetGenerateName(), "kp-") + util.GenerateShortUID())
	}

	return nil
}
