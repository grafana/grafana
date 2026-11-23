// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type ChannelStatus struct {
	// The message count in the last minute
	MinuteRate int64 `json:"minute_rate"`
	// DataFrame schema of the last message
	Data map[string]interface{} `json:"data"`
}

// NewChannelStatus creates a new ChannelStatus object.
func NewChannelStatus() *ChannelStatus {
	return &ChannelStatus{
		Data: map[string]interface{}{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ChannelStatus.
func (ChannelStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.live.pkg.apis.live.v1alpha1.ChannelStatus"
}
