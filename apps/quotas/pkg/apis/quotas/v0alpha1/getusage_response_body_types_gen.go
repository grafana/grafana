// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetUsageBody struct {
	Namespace string `json:"namespace"`
	Resource  string `json:"resource"`
	Group     string `json:"group"`
	Usage     int64  `json:"usage"`
	Limit     int64  `json:"limit"`
}

// NewGetUsageBody creates a new GetUsageBody object.
func NewGetUsageBody() *GetUsageBody {
	return &GetUsageBody{}
}
