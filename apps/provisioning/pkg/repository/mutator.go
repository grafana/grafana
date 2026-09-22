package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"k8s.io/apiserver/pkg/admission"

	provisioningadmission "github.com/grafana/grafana/apps/provisioning/pkg/apis/admission"
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

	if a.GetSubresource() != "" && !provisioningadmission.SpecAndSecureChanged(a) {
		return nil // pure status patch: spec/secure untouched, nothing to (re)mutate
	}

	r, ok := obj.(*provisioning.Repository)
	if !ok {
		return fmt.Errorf("expected repository configuration, got %T", obj)
	}

	// Enforce the presence of finalizers on repositories not marked for deletion.
	// The structural finalizers are re-seeded whenever the list is emptied, but the
	// cleanup finalizer is only seeded on creation. Removing it is the escape hatch
	// that lets an unhealthy repository — one whose credentials can no longer build
	// a provider client — be force-deleted, so it must never be re-added on update.
	if r.DeletionTimestamp == nil || r.DeletionTimestamp.IsZero() {
		if len(r.Finalizers) == 0 {
			r.Finalizers = []string{
				RemoveOrphanResourcesFinalizer,
				RemovePendingJobsFinalizer,
			}
			if a.GetOperation() == admission.Create {
				r.Finalizers = append(r.Finalizers, CleanFinalizer)
			}
		}
	}

	if r.Spec.Sync.IntervalSeconds == 0 || r.Spec.Sync.IntervalSeconds < int64(m.minSyncInterval.Seconds()) {
		r.Spec.Sync.IntervalSeconds = int64(m.minSyncInterval.Seconds())
	}

	if r.Spec.Workflows == nil {
		r.Spec.Workflows = []provisioning.Workflow{}
	}

	if r.Spec.Webhook != nil && r.Spec.Webhook.BaseURL != "" {
		r.Spec.Webhook.BaseURL = strings.TrimRight(r.Spec.Webhook.BaseURL, "/")
	}

	// Extra mutators from factory
	if err := m.factory.Mutate(ctx, r, a.GetOldObject()); err != nil {
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
	if new.Secure.CommitSigningKey.IsZero() {
		new.Secure.CommitSigningKey = old.Secure.CommitSigningKey
	}
}

func RequiresNewTokenForURLChange(new, old *provisioning.Repository) bool {
	return old != nil && new.URL() != old.URL() && new.Secure.Token.IsZero()
}
