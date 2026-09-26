// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type SavedDashboardViewSavedViewVariable struct {
	Name string `json:"name"`
	// "adhoc" | "query" | "custom" | ...
	Type    string                              `json:"type"`
	Value   interface{}                         `json:"value"`
	Filters []SavedDashboardViewSavedViewFilter `json:"filters,omitempty"`
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
	Variables   []SavedDashboardViewSavedViewVariable               `json:"variables"`
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
	Name      string                                  `json:"name"`
	TimeRange SavedDashboardViewV0alpha1SpecTimeRange `json:"timeRange"`
	Variables []SavedDashboardViewSavedViewVariable   `json:"variables"`
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
