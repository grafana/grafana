// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

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
