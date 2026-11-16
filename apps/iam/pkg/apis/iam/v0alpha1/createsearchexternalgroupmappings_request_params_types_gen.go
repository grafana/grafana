// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// query is the schema of the query parameters, whose fields are the parameters.
// Deprecated: declare them in parameters, with in: "query".
type CreateSearchExternalGroupMappingsRequestParams struct {
	Limit  int64 `json:"limit,omitempty"`
	Page   int64 `json:"page,omitempty"`
	Offset int64 `json:"offset,omitempty"`
}

// NewCreateSearchExternalGroupMappingsRequestParams creates a new CreateSearchExternalGroupMappingsRequestParams object.
func NewCreateSearchExternalGroupMappingsRequestParams() *CreateSearchExternalGroupMappingsRequestParams {
	return &CreateSearchExternalGroupMappingsRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchExternalGroupMappingsRequestParams.
func (CreateSearchExternalGroupMappingsRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateSearchExternalGroupMappingsRequestParams"
}
