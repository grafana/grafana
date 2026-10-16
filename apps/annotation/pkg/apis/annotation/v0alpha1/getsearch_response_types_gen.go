// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetSearchAnnotationItem struct {
	ApiVersion string                  `json:"apiVersion"`
	Kind       string                  `json:"kind"`
	Metadata   map[string]interface{}  `json:"metadata"`
	Spec       GetSearchAnnotationSpec `json:"spec"`
}

// NewGetSearchAnnotationItem creates a new GetSearchAnnotationItem object.
func NewGetSearchAnnotationItem() *GetSearchAnnotationItem {
	return &GetSearchAnnotationItem{
		Metadata: map[string]interface{}{},
		Spec:     *NewGetSearchAnnotationSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAnnotationItem.
func (GetSearchAnnotationItem) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetSearchAnnotationItem"
}

// +k8s:openapi-gen=true
type GetSearchAnnotationSpec struct {
	// Text of the annotation.
	Text string `json:"text"`
	// Start time of the annotation, in milliseconds since the Unix epoch.
	Time int64 `json:"time"`
	// End time of the annotation, in milliseconds since the Unix epoch.
	// Set it to make the annotation a region. Omit it, or set it to the same value as time, for a point-in-time annotation.
	TimeEnd *int64 `json:"timeEnd,omitempty"`
	// UID of the dashboard the annotation belongs to. Omit it for an organization-wide annotation.
	DashboardUID *string `json:"dashboardUID,omitempty"`
	// ID of the panel the annotation belongs to, within the dashboard set by dashboardUID.
	// Omit it to show the annotation on every panel of the dashboard.
	PanelID *int64 `json:"panelID,omitempty"`
	// Tags used to categorize and filter annotations.
	Tags []string `json:"tags,omitempty"`
	// Names of the scopes the annotation applies to. The server limits how many scopes an annotation can have (5 by default).
	Scopes []string `json:"scopes,omitempty"`
}

// NewGetSearchAnnotationSpec creates a new GetSearchAnnotationSpec object.
func NewGetSearchAnnotationSpec() *GetSearchAnnotationSpec {
	return &GetSearchAnnotationSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAnnotationSpec.
func (GetSearchAnnotationSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetSearchAnnotationSpec"
}

// +k8s:openapi-gen=true
type GetSearchResponse struct {
	Metadata GetSearchV0alpha1ResponseMetadata `json:"metadata"`
	// Annotations that match the query and that the caller can read.
	Items []GetSearchAnnotationItem `json:"items"`
}

// NewGetSearchResponse creates a new GetSearchResponse object.
func NewGetSearchResponse() *GetSearchResponse {
	return &GetSearchResponse{
		Metadata: *NewGetSearchV0alpha1ResponseMetadata(),
		Items:    []GetSearchAnnotationItem{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchResponse.
func (GetSearchResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetSearchResponse"
}

// +k8s:openapi-gen=true
type GetSearchV0alpha1ResponseMetadata struct {
	// Token for the next page. Pass it as the continue parameter. Empty on the last page.
	Continue *string `json:"continue,omitempty"`
}

// NewGetSearchV0alpha1ResponseMetadata creates a new GetSearchV0alpha1ResponseMetadata object.
func NewGetSearchV0alpha1ResponseMetadata() *GetSearchV0alpha1ResponseMetadata {
	return &GetSearchV0alpha1ResponseMetadata{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchV0alpha1ResponseMetadata.
func (GetSearchV0alpha1ResponseMetadata) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetSearchV0alpha1ResponseMetadata"
}
