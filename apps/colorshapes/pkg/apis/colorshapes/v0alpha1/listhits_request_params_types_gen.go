// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type ListHitsRequestParams struct {
	From *string `json:"from,omitempty"`
	To   *string `json:"to,omitempty"`
}

// NewListHitsRequestParams creates a new ListHitsRequestParams object.
func NewListHitsRequestParams() *ListHitsRequestParams {
	return &ListHitsRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for ListHitsRequestParams.
func (ListHitsRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.colorshapes.pkg.apis.colorshapes.v0alpha1.ListHitsRequestParams"
}
