// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type ChannelSpec struct {
	// The Channel path
	Path string `json:"path"`
	// The message count in the last min
	MinuteRate int64 `json:"minute_rate"`
	// DataFrame schema
	Data map[string]interface{} `json:"data"`
}

// NewChannelSpec creates a new ChannelSpec object.
func NewChannelSpec() *ChannelSpec {
	return &ChannelSpec{
		Data: map[string]interface{}{},
	}
}
