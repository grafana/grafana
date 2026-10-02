package appinstaller

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// overwriteAdmission wraps an already-assembled admission chain so that a Create request
// carrying apistore.OverwriteOnCreateResourceVersion runs real Update-flavored validation
// (with a real OldObject) against the target's GV, when that GV has opted in via a
// registered builder.APIGroupGetter - instead of only ever running Create-flavored
// validation, which is what every downstream REST/storage layer alone can observe.
type overwriteAdmission struct {
	chain   admission.Interface
	getters map[schema.GroupVersion]builder.APIGroupGetter
}

func newOverwriteAdmission(chain admission.Interface, getters map[schema.GroupVersion]builder.APIGroupGetter) *overwriteAdmission {
	return &overwriteAdmission{chain: chain, getters: getters}
}

var (
	_ admission.MutationInterface   = (*overwriteAdmission)(nil)
	_ admission.ValidationInterface = (*overwriteAdmission)(nil)
)

// Handles always reports true, regardless of what the wrapped chain declares. The real
// apiserver only calls Admit/Validate on an admission.Interface when Handles(operation)
// returns true for that operation - so if this delegated to o.chain.Handles and the chain
// ever declined an operation, the apiserver would skip Admit/Validate on this wrapper
// entirely, and the unconditional marker strip at the top of both would never run, letting a
// client-forged marker flow straight through to storage. Always returning true costs nothing:
// Admit/Validate themselves cheaply no-op via the inner type assertion when the wrapped chain
// doesn't actually implement MutationInterface/ValidationInterface, and the strip itself is a
// no-op when there's no marker to strip.
func (o *overwriteAdmission) Handles(_ admission.Operation) bool {
	return true
}

func (o *overwriteAdmission) Admit(ctx context.Context, a admission.Attributes, i admission.ObjectInterfaces) error {
	// Strip before anything else - including before the type assertion below - so a
	// client-forged marker can never survive, even if the wrapped chain doesn't implement
	// MutationInterface at all.
	o.stripClientSuppliedMarker(a)

	mutator, ok := o.chain.(admission.MutationInterface)
	if !ok {
		return nil
	}
	rewritten, err := o.rewrite(ctx, a)
	if err != nil {
		return err
	}
	if err := mutator.Admit(ctx, rewritten, i); err != nil {
		return err
	}
	// Only stamp the marker once the real chain has actually accepted the synthetic
	// re-dispatch - never before, and never for a plain, unrewritten passthrough.
	if rewritten != a {
		o.stampMarker(rewritten)
	}
	return nil
}

func (o *overwriteAdmission) Validate(ctx context.Context, a admission.Attributes, i admission.ObjectInterfaces) error {
	o.stripClientSuppliedMarker(a)

	validator, ok := o.chain.(admission.ValidationInterface)
	if !ok {
		return nil
	}
	rewritten, err := o.rewrite(ctx, a)
	if err != nil {
		return err
	}
	if err := validator.Validate(ctx, rewritten, i); err != nil {
		return err
	}
	if rewritten != a {
		o.stampMarker(rewritten)
	}
	return nil
}

// stripClientSuppliedMarker unconditionally removes any AnnoKeyOverwriteValidated annotation
// a client supplied directly, before any other admission logic runs. It never trusts the
// incoming object and silently no-ops if there's no object (e.g. Delete) or no accessible
// metadata - there's nothing to strip in that case.
func (o *overwriteAdmission) stripClientSuppliedMarker(a admission.Attributes) {
	obj := a.GetObject()
	if obj == nil {
		return
	}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return
	}
	meta.SetAnnotation(utils.AnnoKeyOverwriteValidated, "")
}

// stampMarker marks a as having gone through a successful synthetic re-dispatch. Callers
// must only call this after the wrapped chain has already returned nil for the rewritten
// attributes - never before, and never for an attributes value rewrite() left unchanged.
func (o *overwriteAdmission) stampMarker(a admission.Attributes) {
	meta, err := utils.MetaAccessor(a.GetObject())
	if err != nil {
		return
	}
	meta.SetAnnotation(utils.AnnoKeyOverwriteValidated, "true")
}

// rewrite inspects a genuine sentinel-triggered Create against a GV with a registered
// Getter, and - only in that case - fetches the existing object and returns synthetic
// Update-flavored Attributes carrying it as OldObject. Every other case returns a unchanged
// (the marker, if any, has already been stripped by the caller before this runs). The
// returned Attributes is never marker-stamped here; stamping only happens in Admit/Validate,
// after a successful chain dispatch.
func (o *overwriteAdmission) rewrite(ctx context.Context, a admission.Attributes) (admission.Attributes, error) {
	// A subresource create (e.g. /dashboards/{name}/status) must never trigger this
	// mechanism - treat it exactly like "no Getter registered".
	if a.GetOperation() != admission.Create || a.GetSubresource() != "" {
		return a, nil
	}

	meta, err := utils.MetaAccessor(a.GetObject())
	if err != nil {
		return a, nil
	}
	if meta.GetResourceVersion() != apistore.OverwriteOnCreateResourceVersion {
		return a, nil
	}

	// Getters are keyed by GroupVersion, but a single GroupVersion can serve multiple
	// distinct top-level resources (e.g. dashboards and library panels share a
	// GroupVersion). The Getter itself is responsible for checking a.GetResource() and
	// rejecting a resource it doesn't actually serve; we pass the full GVR through so it
	// can do that.
	getter, ok := o.getters[a.GetResource().GroupVersion()]
	if !ok {
		return a, nil
	}

	existing, err := getter.Get(ctx, a.GetResource(), a.GetNamespace(), a.GetName())
	if err != nil {
		// A NotFound here means either the object genuinely doesn't exist yet (a
		// legitimate first create despite the sentinel RV) or the Getter declined
		// because the requested resource isn't the one it serves (the
		// dashboards-vs-library-panels-vs-variables case above) - both fall back to an
		// unchanged Create passthrough, not a hard failure. Any other error is a real
		// Getter failure and propagates directly, without ever calling the chain.
		if apierrors.IsNotFound(err) {
			return a, nil
		}
		return nil, err
	}
	// A Getter returning (nil, nil) is not a valid "found" result - treat it the same as
	// not found, not as a found object with a nil OldObject.
	if existing == nil {
		return a, nil
	}

	return admission.NewAttributesRecord(
		a.GetObject(), existing, a.GetKind(), a.GetNamespace(), a.GetName(), a.GetResource(), a.GetSubresource(),
		admission.Update, a.GetOperationOptions(), a.IsDryRun(), a.GetUserInfo(),
	), nil
}
