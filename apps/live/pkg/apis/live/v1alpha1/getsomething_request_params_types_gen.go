// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// query is the schema of the query parameters, whose fields are the parameters.
// Deprecated: declare them in parameters, with in: "query".
type GetSomethingRequestParams struct {
	Message *string `json:"message,omitempty"`
}

// NewGetSomethingRequestParams creates a new GetSomethingRequestParams object.
func NewGetSomethingRequestParams() *GetSomethingRequestParams {
	return &GetSomethingRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSomethingRequestParams.
func (GetSomethingRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.live.pkg.apis.live.v1alpha1.GetSomethingRequestParams"
}
