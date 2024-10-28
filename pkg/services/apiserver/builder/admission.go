package builder

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
)

const PluginName = "GrafanaAdmission"

type builderAdmission struct {
	validators map[schema.GroupVersion]APIGroupValidation
}

var _ admission.ValidationInterface = (*builderAdmission)(nil)

func (b *builderAdmission) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	if v, ok := b.validators[a.GetResource().GroupVersion()]; ok {
		return v.Validate(ctx, a, o)
	}
	return nil
}

func (b *builderAdmission) Handles(operation admission.Operation) bool {
	return true
}

func NewAdmissionFromBuilders(builders []APIGroupBuilder) *builderAdmission {
	validators := make(map[schema.GroupVersion]APIGroupValidation)
	for _, builder := range builders {
		if v, ok := builder.(APIGroupValidation); ok {
			validators[builder.GetGroupVersion()] = v
		}
	}
	return NewAdmission(validators)
}

func NewAdmission(validators map[schema.GroupVersion]APIGroupValidation) *builderAdmission {
	return &builderAdmission{
		validators: validators,
	}
}
