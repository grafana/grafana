// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// query is the schema of the query parameters, whose fields are the parameters.
// Deprecated: declare them in parameters, with in: "query".
type ListServiceAccountTokensRequestParams struct {
	Limit    *int64  `json:"limit,omitempty"`
	Continue *string `json:"continue,omitempty"`
}

// NewListServiceAccountTokensRequestParams creates a new ListServiceAccountTokensRequestParams object.
func NewListServiceAccountTokensRequestParams() *ListServiceAccountTokensRequestParams {
	return &ListServiceAccountTokensRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for ListServiceAccountTokensRequestParams.
func (ListServiceAccountTokensRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.ListServiceAccountTokensRequestParams"
}
