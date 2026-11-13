// Package provenance maps the provenance and manager of alerting notifications resources to and
// from the annotations of their Kubernetes objects.
package provenance

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// Object is a Kubernetes object that carries the provenance status annotation.
type Object interface {
	metav1.Object
	GetProvenanceStatus() string
	SetProvenanceStatus(string)
}

// SetAnnotations writes the provenance annotation derived from the manager and, when the manager is
// known, the manager annotations. The provenance is returned so that callers derive anything else
// (e.g. canUse) from the same value.
func SetAnnotations(obj Object, manager utils.ManagerProperties) ngmodels.Provenance {
	provenance := ngmodels.ManagerPropertiesToProvenance(manager)
	obj.SetProvenanceStatus(string(provenance))
	if manager.Kind == utils.ManagerKindUnknown {
		return provenance
	}
	// MetaAccessor only fails for objects that do not implement metav1.Object.
	if meta, err := utils.MetaAccessor(obj); err == nil {
		meta.SetManagerProperties(manager)
	}
	return provenance
}

// FromAnnotations reads the manager of an inbound object. The manager annotations are richer than
// the provenance annotation, so they win when present, but an explicit provenance annotation must
// agree with them. Objects without manager annotations get a manager derived from their provenance
// annotation.
func FromAnnotations(obj Object) (utils.ManagerProperties, error) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return utils.ManagerProperties{}, fmt.Errorf("failed to get metadata: %w", err)
	}
	if mp, ok := meta.GetManagerProperties(); ok {
		derived := ngmodels.ManagerPropertiesToProvenance(mp)
		if source := obj.GetProvenanceStatus(); source != "" && source != string(ngmodels.ProvenanceNone) && source != string(derived) {
			return utils.ManagerProperties{}, fmt.Errorf("manager properties (kind=%s) and provenance annotation (%s) are inconsistent: manager properties imply provenance %q",
				mp.Kind, source, derived)
		}
		return mp, nil
	}

	prov, err := ngmodels.ProvenanceFromString(obj.GetProvenanceStatus())
	if err != nil {
		return utils.ManagerProperties{}, err
	}
	return ngmodels.ProvenanceToManagerProperties(prov), nil
}
