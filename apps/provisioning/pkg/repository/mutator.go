package repository

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"k8s.io/apiserver/pkg/admission"

	provisioningadmission "github.com/grafana/grafana/apps/provisioning/pkg/apis/admission"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
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

	// Enforcing the presence of finalizers in resources not marked for deletion.
	if r.DeletionTimestamp == nil || r.DeletionTimestamp.IsZero() {
		if len(r.Finalizers) == 0 {
			r.Finalizers = []string{
				RemoveOrphanResourcesFinalizer,
				RemovePendingJobsFinalizer,
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

	if r.Spec.Webhook != nil && r.Spec.Webhook.BaseURL != "" {
		r.Spec.Webhook.BaseURL = strings.TrimRight(r.Spec.Webhook.BaseURL, "/")
	}

	// Extra mutators from factory
	if err := m.factory.Mutate(ctx, r, a.GetOldObject()); err != nil {
		return fmt.Errorf("failed to mutate repository: %w", err)
	}

	// After the factory, so the comparison uses the normalized URL that will be stored.
	if a.GetOperation() == admission.Update {
		if oldRepo, ok := a.GetOldObject().(*provisioning.Repository); ok {
			InvalidateConnectionTokenOnURLChange(r, oldRepo)
		}
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

// RequiresNewTokenForURLChange reports whether a URL change must come with a new token.
// The rule exists so a stored credential cannot be repointed at another host.
func RequiresNewTokenForURLChange(new, old *provisioning.Repository) bool {
	if old == nil || new.URL() == old.URL() || suppliedNewToken(new, old) {
		return false
	}

	return !connectionMintsTokenForURLChange(new, old)
}

// InvalidateConnectionTokenOnURLChange marks a connection-minted token for removal when the
// repository moves. The token is scoped to the repository it was minted for, so the
// controller has to mint a new one; keeping it would fail every git operation against the
// new URL until the token nears expiry.
func InvalidateConnectionTokenOnURLChange(new, old *provisioning.Repository) {
	if old == nil || new.URL() == old.URL() {
		return
	}
	// Nothing to invalidate if no token is stored, and a caller-supplied one wins.
	if old.Secure.Token.IsZero() || suppliedNewToken(new, old) {
		return
	}
	// Must match the exemption exactly: marking the token for removal counts as supplying
	// one, which would otherwise satisfy RequiresNewTokenForURLChange and skip the host check.
	if !connectionMintsTokenForURLChange(new, old) {
		return
	}

	new.Secure.Token = common.InlineSecureValue{Remove: true}
}

// suppliedNewToken reports whether the incoming object carries a token decision of its own.
// Echoing the stored reference back is not one: a read-modify-write client resends what it
// read, and treating that as a new token would let it move the URL on the old credential.
// Only the credential identity counts, so a description cannot stand in for a new token.
func suppliedNewToken(new, old *provisioning.Repository) bool {
	token := new.Secure.Token
	switch {
	case token.IsZero():
		return false
	case token.Remove || !token.Create.IsZero():
		return true
	default:
		return token.Name != old.Secure.Token.Name
	}
}

// connectionMintsTokenForURLChange reports whether the connection can mint a token for the
// new URL on the caller's behalf, which it can while the repository stays on the same host.
func connectionMintsTokenForURLChange(new, old *provisioning.Repository) bool {
	return new.HasConnection() && sameURLHost(new.URL(), old.URL())
}

func sameURLHost(a, b string) bool {
	parsedA, err := url.Parse(a)
	if err != nil {
		return false
	}
	parsedB, err := url.Parse(b)
	if err != nil {
		return false
	}

	return parsedA.Host != "" && strings.EqualFold(parsedA.Host, parsedB.Host)
}
