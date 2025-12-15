// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type GetDefaultFields struct {
	DefaultFields []string `json:"defaultFields"`
}

// NewGetDefaultFields creates a new GetDefaultFields object.
func NewGetDefaultFields() *GetDefaultFields {
	return &GetDefaultFields{
		DefaultFields: []string{},
	}
}
