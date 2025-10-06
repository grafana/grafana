// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type FindScopeNavigationsResultsScopeNavigation struct {
	Kind       string                                                   `json:"kind"`
	PluralName string                                                   `json:"pluralName"`
	Schema     FindScopeNavigationsResultsV0alpha1ScopeNavigationSchema `json:"schema"`
}

// NewFindScopeNavigationsResultsScopeNavigation creates a new FindScopeNavigationsResultsScopeNavigation object.
func NewFindScopeNavigationsResultsScopeNavigation() *FindScopeNavigationsResultsScopeNavigation {
	return &FindScopeNavigationsResultsScopeNavigation{
		Kind:       "ScopeNavigation",
		PluralName: "ScopeNavigations",
		Schema:     *NewFindScopeNavigationsResultsV0alpha1ScopeNavigationSchema(),
	}
}

// +k8s:openapi-gen=true
type FindScopeNavigationsResultsSpec struct {
	Message *string                                      `json:"message,omitempty"`
	Items   []FindScopeNavigationsResultsScopeNavigation `json:"items,omitempty"`
}

// NewFindScopeNavigationsResultsSpec creates a new FindScopeNavigationsResultsSpec object.
func NewFindScopeNavigationsResultsSpec() *FindScopeNavigationsResultsSpec {
	return &FindScopeNavigationsResultsSpec{}
}

// +k8s:openapi-gen=true
type FindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaSpec struct {
	Url   string `json:"url"`
	Scope string `json:"scope"`
}

// NewFindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaSpec creates a new FindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaSpec object.
func NewFindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaSpec() *FindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaSpec {
	return &FindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaSpec{}
}

// +k8s:openapi-gen=true
type FindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaStatus struct {
	// Title should be populated and update from the dashboard
	Title string `json:"title"`
	// Groups is used for the grouping of dashboards that are suggested based
	// on a scope. The source of truth for this information has not been
	// determined yet.
	Groups []string `json:"groups,omitempty"`
}

// NewFindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaStatus creates a new FindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaStatus object.
func NewFindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaStatus() *FindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaStatus {
	return &FindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaStatus{}
}

// +k8s:openapi-gen=true
type FindScopeNavigationsResultsV0alpha1ScopeNavigationSchema struct {
	Spec   FindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaSpec   `json:"spec"`
	Status FindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaStatus `json:"status"`
}

// NewFindScopeNavigationsResultsV0alpha1ScopeNavigationSchema creates a new FindScopeNavigationsResultsV0alpha1ScopeNavigationSchema object.
func NewFindScopeNavigationsResultsV0alpha1ScopeNavigationSchema() *FindScopeNavigationsResultsV0alpha1ScopeNavigationSchema {
	return &FindScopeNavigationsResultsV0alpha1ScopeNavigationSchema{
		Spec:   *NewFindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaSpec(),
		Status: *NewFindScopeNavigationsResultsV0alpha1ScopeNavigationSchemaStatus(),
	}
}
