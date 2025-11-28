// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type GetQuotasBody struct {
	Namespace string `json:"namespace"`
	Message   string `json:"message"`
}

// NewGetQuotasBody creates a new GetQuotasBody object.
func NewGetQuotasBody() *GetQuotasBody {
	return &GetQuotasBody{}
}
