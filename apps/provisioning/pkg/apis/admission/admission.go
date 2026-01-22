package admission

import (
	"context"

	"k8s.io/apiserver/pkg/admission"
)

// Mutator handles mutation for a specific resource type
type Mutator interface {
	Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error
}

// Validator handles validation for a specific resource type
type Validator interface {
	Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error
}

// Handler dispatches to registered mutators and validators based on resource type
type Handler struct {
	mutators   map[string]Mutator
	validators map[string]Validator
}

// NewHandler creates a new admission handler
func NewHandler() *Handler {
	return &Handler{
		mutators:   make(map[string]Mutator),
		validators: make(map[string]Validator),
	}
}

// RegisterMutator registers a mutator for a specific resource type
func (h *Handler) RegisterMutator(resource string, m Mutator) {
	h.mutators[resource] = m
}

// RegisterValidator registers a validator for a specific resource type
func (h *Handler) RegisterValidator(resource string, v Validator) {
	h.validators[resource] = v
}

// Mutate dispatches mutation to the appropriate handler based on resource type
func (h *Handler) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()
	if obj == nil || a.GetOperation() == admission.Connect {
		return nil // This is normal for sub-resource
	}

	resource := a.GetResource().Resource
	if m, ok := h.mutators[resource]; ok {
		return m.Mutate(ctx, a, o)
	}

	// No mutator registered for this resource - that's okay, not all resources need mutation
	return nil
}

// Validate dispatches validation to the appropriate handler based on resource type
func (h *Handler) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()
	if obj == nil || a.GetOperation() == admission.Connect || a.GetOperation() == admission.Delete {
		return nil // This is normal for sub-resource
	}

	resource := a.GetResource().Resource
	if v, ok := h.validators[resource]; ok {
		return v.Validate(ctx, a, o)
	}

	// No validator registered for this resource - that's okay, not all resources need validation
	return nil
}
