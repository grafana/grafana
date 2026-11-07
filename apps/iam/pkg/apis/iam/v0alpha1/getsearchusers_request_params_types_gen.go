// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// query is the schema of the query parameters, whose fields are the parameters.
// Deprecated: declare them in parameters, with in: "query".
type GetSearchUsersRequestParams struct {
	Query  *string `json:"query,omitempty"`
	Limit  int64   `json:"limit,omitempty"`
	Offset int64   `json:"offset,omitempty"`
	Page   int64   `json:"page,omitempty"`
}

// NewGetSearchUsersRequestParams creates a new GetSearchUsersRequestParams object.
func NewGetSearchUsersRequestParams() *GetSearchUsersRequestParams {
	return &GetSearchUsersRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchUsersRequestParams.
func (GetSearchUsersRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetSearchUsersRequestParams"
}
