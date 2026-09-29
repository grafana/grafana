package appplugin

import (
	"context"

	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/kindstore"
)

var (
	_ builder.APIGroupMutation   = (*AppPluginAPIBuilder)(nil)
	_ builder.APIGroupValidation = (*AppPluginAPIBuilder)(nil)
)

// Mutate implements [builder.APIGroupMutation]. It reviews the request with the
// plugin for kinds whose manifest declares a mutation capability. The v3 protocol
// answers mutation and validation in one AdmissionReview, so when a kind declares
// both this is the only call and Validate is a no-op.
func (b *AppPluginAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	store := b.kindStoreFor(a)
	if store == nil {
		return nil
	}
	return store.MutateAdmission(ctx, a)
}

// Validate implements [builder.APIGroupValidation]. It reviews the request with the
// plugin for kinds that declare validation but no mutation; when both are declared
// the review already happened in Mutate.
func (b *AppPluginAPIBuilder) Validate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	store := b.kindStoreFor(a)
	if store == nil {
		return nil
	}
	return store.ValidateAdmission(ctx, a)
}

// kindStoreFor resolves the manifest kind a request targets, or nil when the
// request is not for one.
func (b *AppPluginAPIBuilder) kindStoreFor(a admission.Attributes) *kindstore.Store {
	// The v3 admission request has no subresource field, so a hook could not tell
	// a status write from a write to the main resource. Leave those alone.
	if a.GetSubresource() != "" {
		return nil
	}
	return b.kinds[a.GetResource()]
}
