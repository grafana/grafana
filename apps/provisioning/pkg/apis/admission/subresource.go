package admission

import (
	apiequality "k8s.io/apimachinery/pkg/api/equality"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// SpecAndSecureChanged reports whether an update changed spec or secure.
// Mutators/validators use it, instead of GetSubresource() alone, to decide
// whether a subresource request needs spec/secure admission: a status
// strategy opted into bundling (see
// genericStatusStrategy.WithAllowBundlingSpec/Secure) can carry a spec or
// secure change on a /status request, so "which endpoint" and "what changed"
// are different questions once bundling is allowed.
//
// Any error resolving either side, or a missing old object, is treated as
// "changed" so admission runs rather than being skipped on uncertain input.
func SpecAndSecureChanged(a admission.Attributes) bool {
	old := a.GetOldObject()
	if old == nil {
		return true
	}

	newMeta, err := utils.MetaAccessor(a.GetObject())
	if err != nil {
		return true
	}
	oldMeta, err := utils.MetaAccessor(old)
	if err != nil {
		return true
	}

	newSpec, err := newMeta.GetSpec()
	if err != nil {
		return true
	}
	oldSpec, err := oldMeta.GetSpec()
	if err != nil {
		return true
	}
	if !apiequality.Semantic.DeepEqual(newSpec, oldSpec) {
		return true
	}

	newSecure, err := newMeta.GetSecureValues()
	if err != nil {
		return true
	}
	oldSecure, err := oldMeta.GetSecureValues()
	if err != nil {
		return true
	}
	return !apiequality.Semantic.DeepEqual(newSecure, oldSecure)
}
