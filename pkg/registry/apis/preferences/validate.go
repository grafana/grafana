package preferences

import (
	"context"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

	var errors []v1.StatusCause

	if p.Spec.HomeURL != nil {
		errors = append(errors, newInvalidField(
			"May only set the home URL from the system configuration",
			"homeURL"))
	}

	if p.Spec.Timezone != nil && !pref.IsValidTimezone(*p.Spec.Timezone) {
		errors = append(errors, newInvalidField(
			"must be a valid IANA timezone (e.g., America/New_York), 'utc', 'browser', or empty string",
			"timezone"))
	}

	if p.Spec.Theme != nil && *p.Spec.Theme != "" && !pref.IsValidThemeID(*p.Spec.Theme) {
		errors = append(errors, newInvalidField(
			"Invalid theme: must match a configured theme",
			"theme"))
	}

	if len(errors) > 0 {
		return &apierrors.StatusError{v1.Status{
			Status:  v1.StatusFailure,
			Code:    http.StatusBadRequest,
			Reason:  v1.StatusReasonBadRequest,
			Message: "Invalid request",
			Details: &v1.StatusDetails{
				Causes: errors,
			},
		}}
	}

	return nil
}

func newInvalidField(details string, key string) v1.StatusCause {
	return v1.StatusCause{
		Type:    v1.CauseTypeFieldValueInvalid,
		Message: details,
		Field:   fmt.Sprintf("spec.%s", key),
	}
}
