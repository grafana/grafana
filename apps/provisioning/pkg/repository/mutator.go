package repository

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/admission"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// AdmissionMutator handles mutation for Repository resources
type AdmissionMutator struct {
	factory Factory
}

// NewAdmissionMutator creates a new repository mutator
func NewAdmissionMutator(factory Factory) *AdmissionMutator {
	return &AdmissionMutator{
		factory: factory,
	}
}

// Mutate applies mutations to Repository resources
func (m *AdmissionMutator) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()
	if obj == nil {
		return nil
	}

	r, ok := obj.(*provisioning.Repository)
	if !ok {
		return fmt.Errorf("expected repository configuration, got %T", obj)
	}

	// This is called on every update, so be careful to only add the finalizer for create
	if len(r.Finalizers) == 0 && a.GetOperation() == admission.Create {
		r.Finalizers = []string{
			RemoveOrphanResourcesFinalizer,
			CleanFinalizer,
		}
	}

	if r.Spec.Sync.IntervalSeconds == 0 {
		r.Spec.Sync.IntervalSeconds = 60
	}

	if r.Spec.Workflows == nil {
		r.Spec.Workflows = []provisioning.Workflow{}
	}

	// Extra mutators from factory
	if err := m.factory.Mutate(ctx, r); err != nil {
		return fmt.Errorf("failed to mutate repository: %w", err)
	}

	return nil
}

// CopySecureValues copies secure values from old to new repository if they are zero in the new one.
// This preserves existing secrets during updates when they are not provided in the new object.
func CopySecureValues(new, old *provisioning.Repository) {
	if old == nil || old.Secure.IsZero() {
		return
	}
	if new.Secure.Token.IsZero() {
		new.Secure.Token = old.Secure.Token
	}
	if new.Secure.WebhookSecret.IsZero() {
		new.Secure.WebhookSecret = old.Secure.WebhookSecret
	}
}
