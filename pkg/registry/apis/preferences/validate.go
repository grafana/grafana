package preferences

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	pref "github.com/grafana/grafana/pkg/services/preference"
)

// Validate validates that the preference object has valid theme and timezone (if specified)
func (b *APIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	if a.GetResource().Resource != "preferences" {
		return nil
	}
	if op := a.GetOperation(); op != admission.Create && op != admission.Update {
		return nil
	}

	p, ok := a.GetObject().(*preferences.Preferences)
	if !ok {
		return apierrors.NewBadRequest(fmt.Sprintf("expected Preferences object, got %T", a.GetObject()))
	}

	spec := field.NewPath("spec")
	var errs field.ErrorList

	if p.Spec.HomeURL != nil {
		errs = append(errs, field.Forbidden(spec.Child("homeURL"),
			"may only be set from system configuration"))
	}
	if p.Spec.Timezone != nil && !pref.IsValidTimezone(*p.Spec.Timezone) {
		errs = append(errs, field.Invalid(spec.Child("timezone"), *p.Spec.Timezone,
			"must be a valid IANA timezone (e.g., America/New_York), 'utc', 'browser', or empty"))
	}
	if p.Spec.Theme != nil && *p.Spec.Theme != "" && !pref.IsValidThemeID(*p.Spec.Theme) {
		errs = append(errs, field.Invalid(spec.Child("theme"), *p.Spec.Theme,
			"must match a configured theme"))
	}

	if len(errs) > 0 {
		return apierrors.NewInvalid(
			preferences.PreferencesResourceInfo.GroupVersionKind().GroupKind(), p.Name, errs)
	}
	return nil
}
