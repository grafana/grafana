package mutator

import (
	"cmp"
	"fmt"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/util"
	"k8s.io/apiserver/pkg/admission"
)

type secureValueMutator struct{}

var _ contracts.SecureValueMutator = &secureValueMutator{}

func ProvideSecureValueMutator() contracts.SecureValueMutator {
	return &secureValueMutator{}
}

func (*secureValueMutator) Mutate(sv *secretv1beta1.SecureValue, operation admission.Operation) error {
	if sv == nil {
		return fmt.Errorf("expected SecureValue to be non-nil")
	}

	if operation == admission.Create && sv.Name == "" {
		sv.SetName(cmp.Or(sv.GetGenerateName(), "sv-") + util.GenerateShortUID())
	}

	// On any mutation to a `SecureValue`, clear the status.
	if operation == admission.Create || operation == admission.Update {
		sv.Status.ExternalID = ""
		sv.Status.Version = 0
	}

	return nil
}
