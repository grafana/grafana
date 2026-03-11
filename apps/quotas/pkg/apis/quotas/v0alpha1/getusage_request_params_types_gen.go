// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetUsageRequestParams struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
}

// NewGetUsageRequestParams creates a new GetUsageRequestParams object.
func NewGetUsageRequestParams() *GetUsageRequestParams {
	return &GetUsageRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for GetUsageRequestParams.
func (GetUsageRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.quotas.pkg.apis.quotas.v0alpha1.GetUsageRequestParams"
}
