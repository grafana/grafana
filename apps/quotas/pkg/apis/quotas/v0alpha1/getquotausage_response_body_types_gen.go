// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetQuotaUsageBody struct {
	Namespace string `json:"namespace"`
	Resource  string `json:"resource"`
	Group     string `json:"group"`
	Usage     int64  `json:"usage"`
	Limit     int64  `json:"limit"`
}

// NewGetQuotaUsageBody creates a new GetQuotaUsageBody object.
func NewGetQuotaUsageBody() *GetQuotaUsageBody {
	return &GetQuotaUsageBody{}
}

// OpenAPIModelName returns the OpenAPI model name for GetQuotaUsageBody.
func (GetQuotaUsageBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.quotas.pkg.apis.quotas.v0alpha1.GetQuotaUsageBody"
}
