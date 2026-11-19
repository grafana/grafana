package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/validation/path"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"

	v0alpha1 "github.com/grafana/grafana/apps/dashboardviews/pkg/apis/dashboardviews/v0alpha1"
)

// Any viewer can write views, so every field is bounded. The limits sit well above what the UI
// produces; maxSpecBytes caps how far the per-field limits can multiply.
const (
	maxSpecBytes         = 64 << 10
	maxViewsPerDashboard = 100
	maxDashboardUIDRunes = 253
	maxNameRunes         = 100
	maxTimeRangeRunes    = 64
	maxTextRunes         = 1024
	maxVariables         = 100
	maxSectionFilters    = 100
	maxFilters           = 100
	maxValues            = 1000
)

var savedDashboardViewGroupKind = schema.GroupKind{Group: v0alpha1.APIGroup, Kind: "SavedDashboardView"}

// viewCounter returns how many views a dashboard has, up to limit.
type viewCounter func(ctx context.Context, namespace, dashboardUID string, limit int) (int, error)

type validator struct {
	countViews viewCounter
}

func newViewCounter(client *v0alpha1.SavedDashboardViewClient) viewCounter {
	return func(ctx context.Context, namespace, dashboardUID string, limit int) (int, error) {
		list, err := client.List(ctx, namespace, resource.ListOptions{
			FieldSelectors: []string{"spec.dashboardUID=" + dashboardUID},
			Limit:          limit,
		})
		if err != nil {
			return 0, err
		}
		return len(list.Items), nil
	}
}

func (v *validator) validate(ctx context.Context, req *app.AdmissionRequest) error {
	view, ok := req.Object.(*v0alpha1.SavedDashboardView)
	if !ok {
		return apierrors.NewBadRequest(fmt.Sprintf("expected SavedDashboardView, got %T", req.Object))
	}
	if err := validateSpec(view); err != nil {
		return err
	}
	if req.Action != resource.AdmissionActionCreate {
		return nil
	}

	// Concurrent creates can overshoot the cap slightly.
	count, err := v.countViews(ctx, view.Namespace, view.Spec.DashboardUID, maxViewsPerDashboard)
	if err != nil {
		return apierrors.NewInternalError(errors.New("could not count the dashboard's saved views"))
	}
	if count >= maxViewsPerDashboard {
		return apierrors.NewInvalid(savedDashboardViewGroupKind, view.Name, field.ErrorList{
			field.TooMany(field.NewPath("spec", "dashboardUID"), count+1, maxViewsPerDashboard),
		})
	}
	return nil
}

func validateSpec(view *v0alpha1.SavedDashboardView) error {
	spec := field.NewPath("spec")
	var errs field.ErrorList

	if raw, err := json.Marshal(view.Spec); err != nil {
		return apierrors.NewBadRequest("could not encode spec")
	} else if len(raw) > maxSpecBytes {
		// Report this alone: the per-field errors of an oversized spec would be noise.
		return apierrors.NewInvalid(savedDashboardViewGroupKind, view.Name, field.ErrorList{field.TooLong(spec, "", maxSpecBytes)})
	}

	uidPath := spec.Child("dashboardUID")
	switch {
	case view.Spec.DashboardUID == "":
		errs = append(errs, field.Required(uidPath, "must not be empty"))
	case utf8.RuneCountInString(view.Spec.DashboardUID) > maxDashboardUIDRunes:
		errs = append(errs, field.TooLongCharacters(uidPath, view.Spec.DashboardUID, maxDashboardUIDRunes))
	default:
		for _, msg := range path.IsValidPathSegmentName(view.Spec.DashboardUID) {
			errs = append(errs, field.Invalid(uidPath, view.Spec.DashboardUID, msg))
		}
	}

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
		sp := sections.Index(i)
		switch section.SectionKind {
		case v0alpha1.SavedDashboardViewSavedViewSectionFilterSectionKindTab, v0alpha1.SavedDashboardViewSavedViewSectionFilterSectionKindRow:
		default:
			errs = append(errs, field.NotSupported(sp.Child("sectionKind"), section.SectionKind, []v0alpha1.SavedDashboardViewSavedViewSectionFilterSectionKind{
				v0alpha1.SavedDashboardViewSavedViewSectionFilterSectionKindTab,
				v0alpha1.SavedDashboardViewSavedViewSectionFilterSectionKindRow,
			}))
		}
		errs = append(errs, checkRunes(sp.Child("sectionKey"), section.SectionKey, maxTextRunes)...)
		if section.SectionTitle != nil {
			errs = append(errs, checkRunes(sp.Child("sectionTitle"), *section.SectionTitle, maxTextRunes)...)
		}
		errs = append(errs, checkVariables(sp.Child("variables"), section.Variables)...)
	}

	if len(errs) > 0 {
		return apierrors.NewInvalid(savedDashboardViewGroupKind, view.Name, errs)
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
		return field.ErrorList{field.TooLongCharacters(path, value, maxRunes)}
	}
	return nil
}
