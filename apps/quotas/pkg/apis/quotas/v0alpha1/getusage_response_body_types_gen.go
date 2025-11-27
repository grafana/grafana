// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetUsageBody struct {
	Namespace string `json:"namespace"`
	Message   string `json:"message"`
}

// NewGetUsageBody creates a new GetUsageBody object.
func NewGetUsageBody() *GetUsageBody {
	return &GetUsageBody{}
}
