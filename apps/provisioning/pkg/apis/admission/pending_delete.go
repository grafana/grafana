package admission

import (
	"errors"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/admission"

	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// ValidatePendingDeletion blocks mutations on resources whose namespace is pending deletion.
// On Update it returns Forbidden when both the old and new object carry the pending-delete
// label, allowing updates that remove the label (explicit unlock).
// On Create it returns Forbidden when the incoming object already carries the label.
func ValidatePendingDeletion(a admission.Attributes, meta utils.GrafanaMetaAccessor) error {
	switch a.GetOperation() {
	case admission.Update:
		if a.GetSubresource() != "" {
			return nil // status (and other subresource) patches are allowed
		}
		if old := a.GetOldObject(); old != nil {
			if oldMeta, err := utils.MetaAccessor(old); err == nil && appcontroller.IsPendingDelete(oldMeta.GetLabels()) {
				if appcontroller.IsPendingDelete(meta.GetLabels()) {
					return apierrors.NewForbidden(a.GetResource().GroupResource(), a.GetName(), errors.New("namespace is pending deletion"))
				}
			}
		}
	case admission.Create:
		if appcontroller.IsPendingDelete(meta.GetLabels()) {
			return apierrors.NewForbidden(a.GetResource().GroupResource(), a.GetName(), errors.New("namespace is pending deletion"))
		}
	case admission.Delete, admission.Connect:
		// no checks needed
	}
	return nil
}
