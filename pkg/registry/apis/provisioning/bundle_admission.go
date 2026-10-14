package provisioning

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	authtypes "github.com/grafana/authlib/types"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// bundleAdmissionValidator validates Bundle resources during admission.
//
// A Bundle can arrive two ways -- parsed out of a repository, or written straight to the
// API -- and the same paths have to be acceptable on both. Validating here as well as in
// the parser is what keeps those from drifting: a path rejected on one route and accepted
// on the other would be a bundle whose contents depend on how it arrived.
type bundleAdmissionValidator struct{}

func newBundleAdmissionValidator() *bundleAdmissionValidator {
	return &bundleAdmissionValidator{}
}

func (v *bundleAdmissionValidator) Validate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	obj := a.GetObject()
	if obj == nil {
		return nil
	}

	// Do not validate objects we are trying to delete
	meta, _ := utils.MetaAccessor(obj)
	if meta != nil && meta.GetDeletionTimestamp() != nil {
		return nil
	}

	bundle, ok := obj.(*provisioning.Bundle)
	if !ok {
		return fmt.Errorf("expected bundle, got %T", obj)
	}

	if _, err := resources.BundleEntriesFromPaths(bundle.Spec.Paths); err != nil {
		return apierrors.NewInvalid(
			provisioning.BundleResourceInfo.GroupVersionKind().GroupKind(),
			bundle.Name,
			field.ErrorList{field.Invalid(field.NewPath("spec", "paths"), bundle.Spec.Paths, err.Error())},
		)
	}

	return nil
}

// bundleFileAdmissionValidator validates BundleFile resources during admission.
//
// Bundle files are derived from a repository and written by the provisioning pipeline.
// A person editing one directly would be overwritten by the next sync, and until then
// Grafana's copy would disagree with the repository it claims to mirror -- so a write
// from a user identity is refused outright.
//
// This cannot be done in the API authorizer: the reconciler authorizes through that same
// path, so denying the verb there would block the pipeline too. Admission can tell the
// two apart because it sees the requester.
type bundleFileAdmissionValidator struct{}

func newBundleFileAdmissionValidator() *bundleFileAdmissionValidator {
	return &bundleFileAdmissionValidator{}
}

func (v *bundleFileAdmissionValidator) Validate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	obj := a.GetObject()
	if obj == nil {
		return nil
	}

	meta, _ := utils.MetaAccessor(obj)
	if meta != nil && meta.GetDeletionTimestamp() != nil {
		return nil
	}

	file, ok := obj.(*provisioning.BundleFile)
	if !ok {
		return fmt.Errorf("expected bundle file, got %T", obj)
	}

	// A missing or unreadable requester is not a user, so it is left to the authorizer.
	// Only a positively identified user write is refused.
	if requester, err := identity.GetRequester(ctx); err == nil && requester.IsIdentityType(authtypes.TypeUser) {
		return apierrors.NewInvalid(
			provisioning.BundleFileResourceInfo.GroupVersionKind().GroupKind(),
			file.Name,
			field.ErrorList{field.Forbidden(
				field.NewPath("spec"),
				"bundle files are written by provisioning from the repository and cannot be edited directly",
			)},
		)
	}

	if file.Spec.Bundle == "" {
		return apierrors.NewInvalid(
			provisioning.BundleFileResourceInfo.GroupVersionKind().GroupKind(),
			file.Name,
			field.ErrorList{field.Required(field.NewPath("spec", "bundle"), "a bundle file must name its bundle")},
		)
	}

	if file.Spec.Path == "" {
		return apierrors.NewInvalid(
			provisioning.BundleFileResourceInfo.GroupVersionKind().GroupKind(),
			file.Name,
			field.ErrorList{field.Required(field.NewPath("spec", "path"), "a bundle file must name its path")},
		)
	}

	return nil
}
