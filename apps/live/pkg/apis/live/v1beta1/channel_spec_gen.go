// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type ChannelSpec struct {
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
}

// NewChannelSpec creates a new ChannelSpec object.
func NewChannelSpec() *ChannelSpec {
	return &ChannelSpec{}
}
