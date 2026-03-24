// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetQuotaUsageRequestParams struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
}

// NewGetQuotaUsageRequestParams creates a new GetQuotaUsageRequestParams object.
func NewGetQuotaUsageRequestParams() *GetQuotaUsageRequestParams {
	return &GetQuotaUsageRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for GetQuotaUsageRequestParams.
func (GetQuotaUsageRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.quotas.pkg.apis.quotas.v0alpha1.GetQuotaUsageRequestParams"
}
