package repository

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apiserver/pkg/admission"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// AdmissionMutator handles mutation for Repository resources
type AdmissionMutator struct {
	factory         Factory
	minSyncInterval time.Duration
}

// NewAdmissionMutator creates a new repository mutator
func NewAdmissionMutator(
	factory Factory,
	minSyncInterval time.Duration,
) *AdmissionMutator {
	return &AdmissionMutator{
		factory:         factory,
		minSyncInterval: minSyncInterval,
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

	// Enforcing the presence of finalizers in resources not marked for deletion.
	if r.DeletionTimestamp == nil || r.DeletionTimestamp.IsZero() {
		if len(r.Finalizers) == 0 {
			r.Finalizers = []string{
				RemoveOrphanResourcesFinalizer,
				CleanFinalizer,
			}
		}
	}

	if r.Spec.Sync.IntervalSeconds == 0 || r.Spec.Sync.IntervalSeconds < int64(m.minSyncInterval.Seconds()) {
		r.Spec.Sync.IntervalSeconds = int64(m.minSyncInterval.Seconds())
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
