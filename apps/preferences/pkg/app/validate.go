package app

import (
	"context"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana-app-sdk/app"
	v1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
)

// validate checks that the preferences have a valid theme and timezone (when
// specified), and none of what only system configuration may set.
func (c *Config) validate(_ context.Context, req *app.AdmissionRequest) error {
	p, ok := req.Object.(*v1.Preferences)
	if !ok {
		return apierrors.NewBadRequest(fmt.Sprintf("expected Preferences object, got %T", req.Object))
	}

	spec := field.NewPath("spec")
	var errs field.ErrorList

	if p.Spec.HomeURL != nil {
		errs = append(errs, field.Forbidden(spec.Child("homeURL"),
			"may only be set from system configuration"))
	}
	if p.Spec.Timezone != nil && !isValidTimezone(*p.Spec.Timezone) {
		errs = append(errs, field.Invalid(spec.Child("timezone"), *p.Spec.Timezone,
			"must be a valid IANA timezone (e.g., America/New_York), 'utc', 'browser', or empty"))
	}
	if p.Spec.Theme != nil && *p.Spec.Theme != "" && c.IsValidTheme != nil && !c.IsValidTheme(*p.Spec.Theme) {
		errs = append(errs, field.Invalid(spec.Child("theme"), *p.Spec.Theme,
			"must match a configured theme"))
	}

	if len(errs) > 0 {
		return apierrors.NewInvalid(schema.GroupKind{Group: v1.APIGroup, Kind: "Preferences"}, p.Name, errs)
	}
	return nil
}

func isValidTimezone(timezone string) bool {
	if timezone == "" || timezone == "utc" || timezone == "browser" {
		return true
	}
	_, err := time.LoadLocation(timezone)
	return err == nil
}
