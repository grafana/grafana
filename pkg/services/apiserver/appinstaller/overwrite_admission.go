package appinstaller

import (
	"context"

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

func (o *overwriteAdmission) Handles(operation admission.Operation) bool {
	return o.chain.Handles(operation)
}

func (o *overwriteAdmission) Admit(ctx context.Context, a admission.Attributes, i admission.ObjectInterfaces) error {
	mutator, ok := o.chain.(admission.MutationInterface)
	if !ok {
		return nil
	}
	rewritten, err := o.rewrite(ctx, a)
	if err != nil {
		return err
	}
	return mutator.Admit(ctx, rewritten, i)
}

func (o *overwriteAdmission) Validate(ctx context.Context, a admission.Attributes, i admission.ObjectInterfaces) error {
	validator, ok := o.chain.(admission.ValidationInterface)
	if !ok {
		return nil
	}
	rewritten, err := o.rewrite(ctx, a)
	if err != nil {
		return err
	}
	return validator.Validate(ctx, rewritten, i)
}

// rewrite always strips any client-supplied marker first - never trust it - then, only for
// a genuine sentinel-triggered Create against a GV with a registered Getter, fetches the
// existing object and returns synthetic Update-flavored Attributes with the marker freshly
// stamped. Every other case returns a (possibly marker-stripped) but otherwise unchanged a.
func (o *overwriteAdmission) rewrite(ctx context.Context, a admission.Attributes) (admission.Attributes, error) {
	obj := a.GetObject()
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return a, nil
	}
	meta.SetAnnotation(utils.AnnoKeyOverwriteValidated, "")

	if a.GetOperation() != admission.Create || meta.GetResourceVersion() != apistore.OverwriteOnCreateResourceVersion {
		return a, nil
	}
	getter, ok := o.getters[a.GetResource().GroupVersion()]
	if !ok {
		return a, nil
	}

	existing, err := getter.Get(ctx, a.GetNamespace(), a.GetName())
	if err != nil {
		return nil, err
	}

	meta.SetAnnotation(utils.AnnoKeyOverwriteValidated, "true")
	return admission.NewAttributesRecord(
		obj, existing, a.GetKind(), a.GetNamespace(), a.GetName(), a.GetResource(), a.GetSubresource(),
		admission.Update, a.GetOperationOptions(), a.IsDryRun(), a.GetUserInfo(),
	), nil
}
