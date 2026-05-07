// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type ReplaceDefaultFields struct {
	DefaultFields []string `json:"defaultFields"`
}

// NewReplaceDefaultFields creates a new ReplaceDefaultFields object.
func NewReplaceDefaultFields() *ReplaceDefaultFields {
	return &ReplaceDefaultFields{
		DefaultFields: []string{},
	}
}
