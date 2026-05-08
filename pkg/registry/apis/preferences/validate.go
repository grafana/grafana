package preferences

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/admission"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	pref "github.com/grafana/grafana/pkg/services/preference"
)

// Validate validates that the preference object has valid theme and timezone (if specified)
func (b *APIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	if a.GetResource().Resource != "preferences" {
		return nil
	}

	op := a.GetOperation()
	if op != admission.Create && op != admission.Update {
		return nil
	}

	obj := a.GetObject()
	p, ok := obj.(*preferences.Preferences)
	if !ok {
		return apierrors.NewBadRequest(fmt.Sprintf("expected Preferences object, got %T", obj))
	}

	if p.Spec.Timezone != nil && !pref.IsValidTimezone(*p.Spec.Timezone) {
		return apierrors.NewBadRequest("invalid timezone: must be a valid IANA timezone (e.g., America/New_York), 'utc', 'browser', or empty string")
	}

	if p.Spec.Theme != nil && *p.Spec.Theme != "" && !pref.IsValidThemeID(*p.Spec.Theme) {
		return apierrors.NewBadRequest("invalid theme")
	}

	return nil
}
