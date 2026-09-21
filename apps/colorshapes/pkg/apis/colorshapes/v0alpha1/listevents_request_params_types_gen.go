// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type ListEventsRequestParams struct {
	From *string `json:"from,omitempty"`
	To   *string `json:"to,omitempty"`
}

// NewListEventsRequestParams creates a new ListEventsRequestParams object.
func NewListEventsRequestParams() *ListEventsRequestParams {
	return &ListEventsRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for ListEventsRequestParams.
func (ListEventsRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.colorshapes.pkg.apis.colorshapes.v0alpha1.ListEventsRequestParams"
}
