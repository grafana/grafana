// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type QuotaSpec struct {
	Count string `json:"count"`
	Limit string `json:"limit"`
	Kind  string `json:"kind"`
}

// NewQuotaSpec creates a new QuotaSpec object.
func NewQuotaSpec() *QuotaSpec {
	return &QuotaSpec{}
}
