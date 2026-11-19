package app

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"

	v0alpha1 "github.com/grafana/grafana/apps/dashboardviews/pkg/apis/dashboardviews/v0alpha1"
)

func validView() *v0alpha1.SavedDashboardView {
	keyLabel := "Host"
	return &v0alpha1.SavedDashboardView{
		ObjectMeta: metav1.ObjectMeta{Name: "view-1"},
		Spec: v0alpha1.SavedDashboardViewSpec{
			DashboardUID: "dash-1",
			Name:         "My view",
			TimeRange:    v0alpha1.SavedDashboardViewV0alpha1SpecTimeRange{From: "now-6h", To: "now"},
			Variables: []v0alpha1.SavedDashboardViewSavedViewVariable{
				{Name: "env", Type: "query", Value: &v0alpha1.SavedDashboardViewStringOrArrayOfString{ArrayOfString: []string{"a", "b"}}},
				{Name: "filters", Type: "adhoc", Filters: []v0alpha1.SavedDashboardViewSavedViewFilter{
					{Key: "host", KeyLabel: &keyLabel, Operator: "=", Value: "h-1", ValueLabels: []string{"Server A"}},
				}},
			},
		},
	}
}

func validate(view *v0alpha1.SavedDashboardView) error {
	return validateWith(view, resource.AdmissionActionCreate, 0, nil)
}

// validateWith runs the validator with existingViews already on the view's dashboard.
func validateWith(view *v0alpha1.SavedDashboardView, action resource.AdmissionAction, existingViews int, countErr error) error {
	v := &validator{countViews: func(context.Context, string, string, int) (int, error) {
		return existingViews, countErr
	}}
	return v.validate(context.Background(), &app.AdmissionRequest{Action: action, Object: view})
}

// invalidFields returns the field paths of a 422, failing the test for any other error.
func invalidFields(t *testing.T, err error) []string {
	t.Helper()
	if !apierrors.IsInvalid(err) {
		t.Fatalf("expected an Invalid error, got %v", err)
	}
	var status apierrors.APIStatus
	if !errors.As(err, &status) || status.Status().Details == nil {
		t.Fatalf("expected status details on %v", err)
	}
	var fields []string
	for _, cause := range status.Status().Details.Causes {
		fields = append(fields, cause.Field)
	}
	return fields
}

func TestValidateSavedDashboardView(t *testing.T) {
	if err := validate(validView()); err != nil {
		t.Fatalf("a valid view was rejected: %v", err)
	}

	tests := []struct {
		name  string
		field string
		// set applies a value of size n; the limit itself must pass and one over must fail.
		set   func(view *v0alpha1.SavedDashboardView, n int)
		limit int
	}{
		{"name", "spec.name", func(v *v0alpha1.SavedDashboardView, n int) { v.Spec.Name = strings.Repeat("x", n) }, maxNameRunes},
		{"multi-byte name counts runes", "spec.name", func(v *v0alpha1.SavedDashboardView, n int) { v.Spec.Name = strings.Repeat("é", n) }, maxNameRunes},
		{"time range from", "spec.timeRange.from", func(v *v0alpha1.SavedDashboardView, n int) { v.Spec.TimeRange.From = strings.Repeat("x", n) }, maxTimeRangeRunes},
		{"timezone", "spec.timeRange.timezone", func(v *v0alpha1.SavedDashboardView, n int) {
			tz := strings.Repeat("x", n)
			v.Spec.TimeRange.Timezone = &tz
		}, maxTimeRangeRunes},
		{"variable count", "spec.variables", func(v *v0alpha1.SavedDashboardView, n int) {
			v.Spec.Variables = slices.Repeat([]v0alpha1.SavedDashboardViewSavedViewVariable{{Name: "v", Type: "custom"}}, n)
		}, maxVariables},
		{"variable value", "spec.variables[0].value", func(v *v0alpha1.SavedDashboardView, n int) {
			s := strings.Repeat("x", n)
			v.Spec.Variables[0].Value = &v0alpha1.SavedDashboardViewStringOrArrayOfString{String: &s}
		}, maxTextRunes},
		{"variable value count", "spec.variables[0].value", func(v *v0alpha1.SavedDashboardView, n int) {
			v.Spec.Variables[0].Value = &v0alpha1.SavedDashboardViewStringOrArrayOfString{ArrayOfString: slices.Repeat([]string{"a"}, n)}
		}, maxValues},
		{"filter count", "spec.variables[1].filters", func(v *v0alpha1.SavedDashboardView, n int) {
			v.Spec.Variables[1].Filters = slices.Repeat([]v0alpha1.SavedDashboardViewSavedViewFilter{{Key: "k", Operator: "=", Value: "v"}}, n)
		}, maxFilters},
		{"filter value labels", "spec.variables[1].filters[0].valueLabels", func(v *v0alpha1.SavedDashboardView, n int) {
			v.Spec.Variables[1].Filters[0].ValueLabels = slices.Repeat([]string{"a"}, n)
		}, maxValues},
		{"filter key label", "spec.variables[1].filters[0].keyLabel", func(v *v0alpha1.SavedDashboardView, n int) {
			label := strings.Repeat("x", n)
			v.Spec.Variables[1].Filters[0].KeyLabel = &label
		}, maxTextRunes},
		{"section count", "spec.sectionFilters", func(v *v0alpha1.SavedDashboardView, n int) {
			v.Spec.SectionFilters = slices.Repeat([]v0alpha1.SavedDashboardViewSavedViewSectionFilter{{SectionKind: "tab", SectionKey: "/tabs/0"}}, n)
		}, maxSectionFilters},
		{"section variables", "spec.sectionFilters[0].variables", func(v *v0alpha1.SavedDashboardView, n int) {
			v.Spec.SectionFilters = []v0alpha1.SavedDashboardViewSavedViewSectionFilter{{
				SectionKind: "tab",
				SectionKey:  "/tabs/0",
				Variables:   slices.Repeat([]v0alpha1.SavedDashboardViewSavedViewVariable{{Name: "v", Type: "adhoc"}}, n),
			}}
		}, maxVariables},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			atLimit := validView()
			tt.set(atLimit, tt.limit)
			if err := validate(atLimit); err != nil {
				t.Fatalf("exactly %d was rejected: %v", tt.limit, err)
			}

			over := validView()
			tt.set(over, tt.limit+1)
			if fields := invalidFields(t, validate(over)); !slices.Contains(fields, tt.field) {
				t.Fatalf("expected a cause on %s, got %v", tt.field, fields)
			}
		})
	}

	t.Run("an empty name is required", func(t *testing.T) {
		view := validView()
		view.Spec.Name = "  "
		if fields := invalidFields(t, validate(view)); !slices.Contains(fields, "spec.name") {
			t.Fatalf("expected a cause on spec.name, got %v", fields)
		}
	})
}

func TestValidateSavedDashboardViewSpecSize(t *testing.T) {
	// Each value is well within its own limit; together they exceed the whole-spec cap.
	big := validView()
	big.Spec.Variables[0].Value = &v0alpha1.SavedDashboardViewStringOrArrayOfString{
		ArrayOfString: slices.Repeat([]string{strings.Repeat("x", maxTextRunes)}, maxSpecBytes/maxTextRunes+1),
	}
	if fields := invalidFields(t, validate(big)); !slices.Equal(fields, []string{"spec"}) {
		t.Fatalf("expected a single cause on spec, got %v", fields)
	}

	justUnder := validView()
	justUnder.Spec.Variables[0].Value = &v0alpha1.SavedDashboardViewStringOrArrayOfString{
		ArrayOfString: slices.Repeat([]string{strings.Repeat("x", maxTextRunes)}, maxSpecBytes/maxTextRunes-2),
	}
	if err := validate(justUnder); err != nil {
		t.Fatalf("a spec under the cap was rejected: %v", err)
	}
}

func TestValidateSavedDashboardViewDashboardUID(t *testing.T) {
	for _, uid := range []string{"", "a/b", "..", "50%", strings.Repeat("x", maxDashboardUIDRunes+1)} {
		view := validView()
		view.Spec.DashboardUID = uid
		if fields := invalidFields(t, validate(view)); !slices.Contains(fields, "spec.dashboardUID") {
			t.Fatalf("expected %q to be rejected, got %v", uid, fields)
		}
	}
	view := validView()
	view.Spec.DashboardUID = strings.Repeat("x", maxDashboardUIDRunes)
	if err := validate(view); err != nil {
		t.Fatalf("a %d-character uid was rejected: %v", maxDashboardUIDRunes, err)
	}
}

func TestValidateSavedDashboardViewSectionKind(t *testing.T) {
	view := validView()
	view.Spec.SectionFilters = []v0alpha1.SavedDashboardViewSavedViewSectionFilter{{SectionKind: "panel", SectionKey: "/tabs/0"}}
	if fields := invalidFields(t, validate(view)); !slices.Contains(fields, "spec.sectionFilters[0].sectionKind") {
		t.Fatalf("expected the section kind to be rejected, got %v", fields)
	}
}

func TestValidateSavedDashboardViewCountCap(t *testing.T) {
	if err := validateWith(validView(), resource.AdmissionActionCreate, maxViewsPerDashboard-1, nil); err != nil {
		t.Fatalf("creating view %d was rejected: %v", maxViewsPerDashboard, err)
	}
	if fields := invalidFields(t, validateWith(validView(), resource.AdmissionActionCreate, maxViewsPerDashboard, nil)); !slices.Contains(fields, "spec.dashboardUID") {
		t.Fatalf("expected the cap on spec.dashboardUID, got %v", fields)
	}
	if err := validateWith(validView(), resource.AdmissionActionUpdate, maxViewsPerDashboard, nil); err != nil {
		t.Fatalf("an update at the cap was rejected: %v", err)
	}

	err := validateWith(validView(), resource.AdmissionActionCreate, 0, errors.New("storage at 10.0.0.7 unreachable"))
	if !apierrors.IsInternalError(err) || strings.Contains(err.Error(), "10.0.0.7") {
		t.Fatalf("expected a generic internal error, got %v", err)
	}
}
