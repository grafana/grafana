package builder

import (
	"context"

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
