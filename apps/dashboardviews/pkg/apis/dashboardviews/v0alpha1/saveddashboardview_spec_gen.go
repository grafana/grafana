// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	json "encoding/json"
	errors "errors"
)

// +k8s:openapi-gen=true
type SavedDashboardViewSavedViewVariable struct {
	Name string `json:"name"`
	// "adhoc" | "query" | "custom" | ...
	Type string `json:"type"`
	// value is the variable's scalar or multi-value selection (query/custom/datasource variables).
	// Omitted for ad-hoc variables, which carry their state in filters instead.
	Value   *SavedDashboardViewStringOrArrayOfString `json:"value,omitempty"`
	Filters []SavedDashboardViewSavedViewFilter      `json:"filters,omitempty"`
}

// NewSavedDashboardViewSavedViewVariable creates a new SavedDashboardViewSavedViewVariable object.
func NewSavedDashboardViewSavedViewVariable() *SavedDashboardViewSavedViewVariable {
	return &SavedDashboardViewSavedViewVariable{}
}

// OpenAPIModelName returns the OpenAPI model name for SavedDashboardViewSavedViewVariable.
func (SavedDashboardViewSavedViewVariable) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboardviews.pkg.apis.dashboardviews.v0alpha1.SavedDashboardViewSavedViewVariable"
}

// +k8s:openapi-gen=true
type SavedDashboardViewSavedViewFilter struct {
	Key      string `json:"key"`
	Operator string `json:"operator"`
	Value    string `json:"value"`
}

// NewSavedDashboardViewSavedViewFilter creates a new SavedDashboardViewSavedViewFilter object.
func NewSavedDashboardViewSavedViewFilter() *SavedDashboardViewSavedViewFilter {
	return &SavedDashboardViewSavedViewFilter{}
}

// OpenAPIModelName returns the OpenAPI model name for SavedDashboardViewSavedViewFilter.
func (SavedDashboardViewSavedViewFilter) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboardviews.pkg.apis.dashboardviews.v0alpha1.SavedDashboardViewSavedViewFilter"
}

// +k8s:openapi-gen=true
type SavedDashboardViewSavedViewSectionFilter struct {
	SectionKind SavedDashboardViewSavedViewSectionFilterSectionKind `json:"sectionKind"`
	SectionKey  string                                              `json:"sectionKey"`
	// sectionTitle is the tab/row's title at capture time, used to sanity-check on apply that the
	// section resolved at sectionKey still looks like the same one -- layout edits (reordering,
	// inserting, deleting tabs/rows) can leave sectionKey resolving successfully but to a
	// different section. Optional for backward compatibility with views saved before this field
	// existed; those still apply unconditionally, same as before.
	SectionTitle *string                               `json:"sectionTitle,omitempty"`
	Variables    []SavedDashboardViewSavedViewVariable `json:"variables"`
}

// NewSavedDashboardViewSavedViewSectionFilter creates a new SavedDashboardViewSavedViewSectionFilter object.
func NewSavedDashboardViewSavedViewSectionFilter() *SavedDashboardViewSavedViewSectionFilter {
	return &SavedDashboardViewSavedViewSectionFilter{
		Variables: []SavedDashboardViewSavedViewVariable{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for SavedDashboardViewSavedViewSectionFilter.
func (SavedDashboardViewSavedViewSectionFilter) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboardviews.pkg.apis.dashboardviews.v0alpha1.SavedDashboardViewSavedViewSectionFilter"
}

// +k8s:openapi-gen=true
type SavedDashboardViewSpec struct {
	// dashboardUID is the dashboard this view belongs to. A view only ever applies to the
	// dashboard it was created on.
	DashboardUID string `json:"dashboardUID"`
	// name is the user-facing label for this view (distinct from metadata.name, which is the
	// resource's system-generated identifier).
	Name string `json:"name"`
	// description is an optional user-facing note about this view.
	Description *string                                 `json:"description,omitempty"`
	TimeRange   SavedDashboardViewV0alpha1SpecTimeRange `json:"timeRange"`
	Variables   []SavedDashboardViewSavedViewVariable   `json:"variables"`
	// sectionFilters captures ad-hoc filters scoped to a tab or row rather than the whole
	// dashboard. Stretch goal — omitted entirely on dashboards that don't use tabs/rows.
	SectionFilters []SavedDashboardViewSavedViewSectionFilter `json:"sectionFilters,omitempty"`
}

// NewSavedDashboardViewSpec creates a new SavedDashboardViewSpec object.
func NewSavedDashboardViewSpec() *SavedDashboardViewSpec {
	return &SavedDashboardViewSpec{
		TimeRange: *NewSavedDashboardViewV0alpha1SpecTimeRange(),
		Variables: []SavedDashboardViewSavedViewVariable{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for SavedDashboardViewSpec.
func (SavedDashboardViewSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboardviews.pkg.apis.dashboardviews.v0alpha1.SavedDashboardViewSpec"
}

// +k8s:openapi-gen=true
type SavedDashboardViewV0alpha1SpecTimeRange struct {
	From     string  `json:"from"`
	To       string  `json:"to"`
	Timezone *string `json:"timezone,omitempty"`
}

// NewSavedDashboardViewV0alpha1SpecTimeRange creates a new SavedDashboardViewV0alpha1SpecTimeRange object.
func NewSavedDashboardViewV0alpha1SpecTimeRange() *SavedDashboardViewV0alpha1SpecTimeRange {
	return &SavedDashboardViewV0alpha1SpecTimeRange{}
}

// OpenAPIModelName returns the OpenAPI model name for SavedDashboardViewV0alpha1SpecTimeRange.
func (SavedDashboardViewV0alpha1SpecTimeRange) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboardviews.pkg.apis.dashboardviews.v0alpha1.SavedDashboardViewV0alpha1SpecTimeRange"
}

// +k8s:openapi-gen=true
type SavedDashboardViewSavedViewSectionFilterSectionKind string

const (
	SavedDashboardViewSavedViewSectionFilterSectionKindTab SavedDashboardViewSavedViewSectionFilterSectionKind = "tab"
	SavedDashboardViewSavedViewSectionFilterSectionKindRow SavedDashboardViewSavedViewSectionFilterSectionKind = "row"
)

// OpenAPIModelName returns the OpenAPI model name for SavedDashboardViewSavedViewSectionFilterSectionKind.
func (SavedDashboardViewSavedViewSectionFilterSectionKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboardviews.pkg.apis.dashboardviews.v0alpha1.SavedDashboardViewSavedViewSectionFilterSectionKind"
}

// +k8s:openapi-gen=true
type SavedDashboardViewStringOrArrayOfString struct {
	String        *string  `json:"String,omitempty"`
	ArrayOfString []string `json:"ArrayOfString,omitempty"`
}

// NewSavedDashboardViewStringOrArrayOfString creates a new SavedDashboardViewStringOrArrayOfString object.
func NewSavedDashboardViewStringOrArrayOfString() *SavedDashboardViewStringOrArrayOfString {
	return &SavedDashboardViewStringOrArrayOfString{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `SavedDashboardViewStringOrArrayOfString` as JSON.
func (resource SavedDashboardViewStringOrArrayOfString) MarshalJSON() ([]byte, error) {
	if resource.String != nil {
		return json.Marshal(resource.String)
	}

	if resource.ArrayOfString != nil {
		return json.Marshal(resource.ArrayOfString)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `SavedDashboardViewStringOrArrayOfString` from JSON.
func (resource *SavedDashboardViewStringOrArrayOfString) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	var errList []error

	// String
	var String string
	if err := json.Unmarshal(raw, &String); err != nil {
		errList = append(errList, err)
		resource.String = nil
	} else {
		resource.String = &String
		return nil
	}

	// ArrayOfString
	var ArrayOfString []string
	if err := json.Unmarshal(raw, &ArrayOfString); err != nil {
		errList = append(errList, err)
		resource.ArrayOfString = nil
	} else {
		resource.ArrayOfString = ArrayOfString
		return nil
	}

	return errors.Join(errList...)
}

// OpenAPIModelName returns the OpenAPI model name for SavedDashboardViewStringOrArrayOfString.
func (SavedDashboardViewStringOrArrayOfString) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboardviews.pkg.apis.dashboardviews.v0alpha1.SavedDashboardViewStringOrArrayOfString"
}
