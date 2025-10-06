// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type FindScopeDashboardBindingsResultsScopeDashboardBinding struct {
	Kind       string                                                               `json:"kind"`
	PluralName string                                                               `json:"pluralName"`
	Schema     FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchema `json:"schema"`
}

// NewFindScopeDashboardBindingsResultsScopeDashboardBinding creates a new FindScopeDashboardBindingsResultsScopeDashboardBinding object.
func NewFindScopeDashboardBindingsResultsScopeDashboardBinding() *FindScopeDashboardBindingsResultsScopeDashboardBinding {
	return &FindScopeDashboardBindingsResultsScopeDashboardBinding{
		Kind:       "ScopeDashboardBinding",
		PluralName: "ScopeDashboardBindings",
		Schema:     *NewFindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchema(),
	}
}

// +k8s:openapi-gen=true
type FindScopeDashboardBindingsResultsSpec struct {
	Message *string                                                  `json:"message,omitempty"`
	Items   []FindScopeDashboardBindingsResultsScopeDashboardBinding `json:"items,omitempty"`
}

// NewFindScopeDashboardBindingsResultsSpec creates a new FindScopeDashboardBindingsResultsSpec object.
func NewFindScopeDashboardBindingsResultsSpec() *FindScopeDashboardBindingsResultsSpec {
	return &FindScopeDashboardBindingsResultsSpec{}
}

// +k8s:openapi-gen=true
type FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaSpec struct {
	Dashboard string `json:"dashboard"`
	Scope     string `json:"scope"`
}

// NewFindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaSpec creates a new FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaSpec object.
func NewFindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaSpec() *FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaSpec {
	return &FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaSpec{}
}

// +k8s:openapi-gen=true
type FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaStatus struct {
	// DashboardTitle should be populated and update from the dashboard
	DashboardTitle string `json:"dashboardTitle"`
	// Groups is used for the grouping of dashboards that are suggested based
	// on a scope. The source of truth for this information has not been
	// determined yet.
	Groups []string `json:"groups,omitempty"`
}

// NewFindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaStatus creates a new FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaStatus object.
func NewFindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaStatus() *FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaStatus {
	return &FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaStatus{}
}

// +k8s:openapi-gen=true
type FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchema struct {
	Spec   FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaSpec   `json:"spec"`
	Status FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaStatus `json:"status"`
}

// NewFindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchema creates a new FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchema object.
func NewFindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchema() *FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchema {
	return &FindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchema{
		Spec:   *NewFindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaSpec(),
		Status: *NewFindScopeDashboardBindingsResultsV0alpha1ScopeDashboardBindingSchemaStatus(),
	}
}
