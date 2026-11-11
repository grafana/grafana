package folders

import (
	"fmt"
	"time"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
)

func validatePendingDeletion(a admission.Attributes) error {
	if a.GetOperation() != admission.Create && a.GetOperation() != admission.Update {
		return nil
	}
	p, ok := a.GetObject().(*foldersv1.PendingFolderDeletion)
	if !ok {
		return fmt.Errorf("expected PendingFolderDeletion")
	}
	var errs field.ErrorList
	spec := field.NewPath("spec")
	if p.Spec.FolderName == "" {
		errs = append(errs, field.Required(spec.Child("folderName"), "folderName is required"))
	}
	if p.Spec.FolderUID == "" {
		errs = append(errs, field.Required(spec.Child("folderUID"), "folderUID is required"))
	}
	if p.Spec.DeletionTimestamp != nil {
		if _, err := time.Parse(time.RFC3339Nano, *p.Spec.DeletionTimestamp); err != nil {
			errs = append(errs, field.Invalid(spec.Child("deletionTimestamp"), *p.Spec.DeletionTimestamp, err.Error()))
		}
	}
	if a.GetOperation() == admission.Update {
		old, ok := a.GetOldObject().(*foldersv1.PendingFolderDeletion)
		if !ok {
			return fmt.Errorf("expected old PendingFolderDeletion")
		}
		if p.Spec.FolderName != old.Spec.FolderName {
			errs = append(errs, field.Invalid(spec.Child("folderName"), p.Spec.FolderName, "field is immutable"))
		}
		if p.Spec.FolderUID != old.Spec.FolderUID {
			errs = append(errs, field.Invalid(spec.Child("folderUID"), p.Spec.FolderUID, "field is immutable"))
		}
		// Intent precedes deletion; allow capturing its timestamp once, but never replacing it.
		if old.Spec.DeletionTimestamp != nil && (p.Spec.DeletionTimestamp == nil || *p.Spec.DeletionTimestamp != *old.Spec.DeletionTimestamp) {
			errs = append(errs, field.Invalid(spec.Child("deletionTimestamp"), p.Spec.DeletionTimestamp, "captured deletionTimestamp is immutable"))
		}
	}
	if len(errs) > 0 {
		return apierrors.NewInvalid(foldersv1.PendingFolderDeletionResourceInfo.GroupVersionKind().GroupKind(), p.Name, errs)
	}
	return nil
}
