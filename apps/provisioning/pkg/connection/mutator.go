package connection

import (
	"cmp"
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/admission"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util"
)

// AdmissionMutator handles mutation for Connection resources
type AdmissionMutator struct {
	factory Factory
}

// NewAdmissionMutator creates a new connection mutator
func NewAdmissionMutator(factory Factory) *AdmissionMutator {
	return &AdmissionMutator{
		factory: factory,
	}
}

// Mutate applies mutations to Connection resources
func (m *AdmissionMutator) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()
	if obj == nil {
		return nil
	}

	c, ok := obj.(*provisioning.Connection)
	if !ok {
		return fmt.Errorf("expected connection configuration, got %T", obj)
	}

	namePrefix := fmt.Sprintf("%s-", c.Spec.Type)
	if a.GetOperation() == admission.Create && c.GetName() == "" {
		c.SetName(cmp.Or(c.GetGenerateName(), namePrefix) + util.GenerateShortUID())
	}

	return m.factory.Mutate(ctx, c)
}

// CopySecureValues copies secure values from old to new connection if they are zero in the new one.
// This preserves existing secrets during updates when they are not provided in the new object.
func CopySecureValues(new, old *provisioning.Connection) {
	if old == nil || old.Secure.IsZero() {
		return
	}
	if new.Secure.PrivateKey.IsZero() {
		new.Secure.PrivateKey = old.Secure.PrivateKey
	}
	if new.Secure.Token.IsZero() {
		new.Secure.Token = old.Secure.Token
	}
	if new.Secure.ClientSecret.IsZero() {
		new.Secure.ClientSecret = old.Secure.ClientSecret
	}
}
