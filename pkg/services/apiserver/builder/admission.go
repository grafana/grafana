package builder

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
)

type builderAdmission struct {
	mutators   map[schema.GroupVersion]APIGroupMutation
	validators map[schema.GroupVersion]APIGroupValidation
}

var _ admission.MutationInterface = (*builderAdmission)(nil)
var _ admission.ValidationInterface = (*builderAdmission)(nil)

func (b *builderAdmission) Admit(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	// on create, if the object does not have a name or a generate name specified, set one
	// the name is the grafana uid, so we should not fail if it is not set
	if a.GetOperation() == admission.Create {
		obj := a.GetObject()
		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return err
		}
		if meta.GetName() == "" && meta.GetGenerateName() == "" {
			// a unique uid will be added to the end of it
			meta.SetGenerateName("g")
		}
	}

	if m, ok := b.mutators[a.GetResource().GroupVersion()]; ok {
		return m.Mutate(ctx, a, o)
	}

	return nil
}

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
	mutators := make(map[schema.GroupVersion]APIGroupMutation)
	validators := make(map[schema.GroupVersion]APIGroupValidation)
	for _, builder := range builders {
		for _, gv := range GetGroupVersions(builder) {
			if m, ok := builder.(APIGroupMutation); ok {
				mutators[gv] = m
			}
			if v, ok := builder.(APIGroupValidation); ok {
				validators[gv] = v
			}
		}
	}
	return NewAdmission(mutators, validators)
}

func NewAdmission(mutators map[schema.GroupVersion]APIGroupMutation, validators map[schema.GroupVersion]APIGroupValidation) *builderAdmission {
	return &builderAdmission{
		mutators:   mutators,
		validators: validators,
	}
}
