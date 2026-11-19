package app

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana-app-sdk/app"

	v0alpha1 "github.com/grafana/grafana/apps/dashboardviews/pkg/apis/dashboardviews/v0alpha1"
)

// Any viewer can write views, so every field is bounded. The limits sit well above what the UI
// produces.
const (
	maxNameRunes      = 100
	maxTimeRangeRunes = 64
	maxTextRunes      = 1024
	maxVariables      = 100
	maxSectionFilters = 100
	maxFilters        = 100
	maxValues         = 1000
)

func validateSavedDashboardView(_ context.Context, req *app.AdmissionRequest) error {
	view, ok := req.Object.(*v0alpha1.SavedDashboardView)
	if !ok {
		return apierrors.NewBadRequest(fmt.Sprintf("expected SavedDashboardView, got %T", req.Object))
	}

	spec := field.NewPath("spec")
	var errs field.ErrorList

	if strings.TrimSpace(view.Spec.Name) == "" {
		errs = append(errs, field.Required(spec.Child("name"), "must not be empty"))
	}
	errs = append(errs, checkRunes(spec.Child("name"), view.Spec.Name, maxNameRunes)...)

	timeRange := spec.Child("timeRange")
	errs = append(errs, checkRunes(timeRange.Child("from"), view.Spec.TimeRange.From, maxTimeRangeRunes)...)
	errs = append(errs, checkRunes(timeRange.Child("to"), view.Spec.TimeRange.To, maxTimeRangeRunes)...)
	if view.Spec.TimeRange.Timezone != nil {
		errs = append(errs, checkRunes(timeRange.Child("timezone"), *view.Spec.TimeRange.Timezone, maxTimeRangeRunes)...)
	}

	errs = append(errs, checkVariables(spec.Child("variables"), view.Spec.Variables)...)

	sections := spec.Child("sectionFilters")
	errs = append(errs, checkCount(sections, len(view.Spec.SectionFilters), maxSectionFilters)...)
	for i, section := range view.Spec.SectionFilters {
		path := sections.Index(i)
		errs = append(errs, checkRunes(path.Child("sectionKey"), section.SectionKey, maxTextRunes)...)
		if section.SectionTitle != nil {
			errs = append(errs, checkRunes(path.Child("sectionTitle"), *section.SectionTitle, maxTextRunes)...)
		}
		errs = append(errs, checkVariables(path.Child("variables"), section.Variables)...)
	}

	if len(errs) > 0 {
		return apierrors.NewInvalid(schema.GroupKind{Group: v0alpha1.APIGroup, Kind: "SavedDashboardView"}, view.Name, errs)
	}
	return nil
}

func checkVariables(path *field.Path, variables []v0alpha1.SavedDashboardViewSavedViewVariable) field.ErrorList {
	errs := checkCount(path, len(variables), maxVariables)
	for i, variable := range variables {
		vp := path.Index(i)
		errs = append(errs, checkRunes(vp.Child("name"), variable.Name, maxTextRunes)...)
		errs = append(errs, checkRunes(vp.Child("type"), variable.Type, maxTextRunes)...)
		if variable.Value != nil {
			if variable.Value.String != nil {
				errs = append(errs, checkRunes(vp.Child("value"), *variable.Value.String, maxTextRunes)...)
			}
			errs = append(errs, checkStrings(vp.Child("value"), variable.Value.ArrayOfString, maxValues)...)
		}

		filters := vp.Child("filters")
		errs = append(errs, checkCount(filters, len(variable.Filters), maxFilters)...)
		for j, filter := range variable.Filters {
			fp := filters.Index(j)
			errs = append(errs, checkRunes(fp.Child("key"), filter.Key, maxTextRunes)...)
			errs = append(errs, checkRunes(fp.Child("operator"), filter.Operator, maxTextRunes)...)
			errs = append(errs, checkRunes(fp.Child("value"), filter.Value, maxTextRunes)...)
			if filter.KeyLabel != nil {
				errs = append(errs, checkRunes(fp.Child("keyLabel"), *filter.KeyLabel, maxTextRunes)...)
			}
			errs = append(errs, checkStrings(fp.Child("values"), filter.Values, maxValues)...)
			errs = append(errs, checkStrings(fp.Child("valueLabels"), filter.ValueLabels, maxValues)...)
		}
	}
	return errs
}

func checkStrings(path *field.Path, values []string, maxItems int) field.ErrorList {
	errs := checkCount(path, len(values), maxItems)
	for i, value := range values {
		errs = append(errs, checkRunes(path.Index(i), value, maxTextRunes)...)
	}
	return errs
}

func checkCount(path *field.Path, count, maxItems int) field.ErrorList {
	if count > maxItems {
		return field.ErrorList{field.TooMany(path, count, maxItems)}
	}
	return nil
}

func checkRunes(path *field.Path, value string, maxRunes int) field.ErrorList {
	if n := utf8.RuneCountInString(value); n > maxRunes {
		return field.ErrorList{field.TooLong(path, value, maxRunes)}
	}
	return nil
}
