// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetQuotaUsageBody struct {
	Namespace string `json:"namespace"`
	Group     string `json:"group"`
	Resource  string `json:"resource"`
	Usage     int64  `json:"usage"`
	Limit     int64  `json:"limit"`
}

// NewGetQuotaUsageBody creates a new GetQuotaUsageBody object.
func NewGetQuotaUsageBody() *GetQuotaUsageBody {
	return &GetQuotaUsageBody{}
}
