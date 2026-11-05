package admission

import (
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// ValidateManagerKind blocks writes that mark a Repository or Connection as repository-managed.
// Provisioning never writes these two kinds as repository files, so the generic manager check in
// unified storage forwards such a write to the provisioning files endpoint, which has no source
// path to write to and fails with an opaque internal error instead of a usable one.
func ValidateManagerKind(a admission.Attributes, meta utils.GrafanaMetaAccessor) error {
	switch a.GetOperation() {
	case admission.Create, admission.Update:
		if utils.ParseManagerKindString(meta.GetAnnotation(utils.AnnoKeyManagerKind)) != utils.ManagerKindRepo {
			return nil
		}
		return apierrors.NewForbidden(a.GetResource().GroupResource(), a.GetName(),
			fmt.Errorf("%s cannot be set to %q: this kind is not provisioned from repository files",
				utils.AnnoKeyManagerKind, utils.ManagerKindRepo))
	case admission.Delete, admission.Connect:
		return nil
	}
	return nil
}
