// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// query is the schema of the query parameters, whose fields are the parameters.
// Deprecated: declare them in parameters, with in: "query".
type GetOtherRequestParams struct {
	Message *string `json:"message,omitempty"`
}

// NewGetOtherRequestParams creates a new GetOtherRequestParams object.
func NewGetOtherRequestParams() *GetOtherRequestParams {
	return &GetOtherRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for GetOtherRequestParams.
func (GetOtherRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.example.pkg.apis.example.v1alpha1.GetOtherRequestParams"
}
