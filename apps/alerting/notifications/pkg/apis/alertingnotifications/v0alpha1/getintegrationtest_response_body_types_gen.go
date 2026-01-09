// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

// +k8s:openapi-gen=true
type GetIntegrationTestBody struct {
	Timestamp time.Time `json:"timestamp"`
	Duration  string    `json:"duration"`
	Error     *string   `json:"error,omitempty"`
}

// NewGetIntegrationTestBody creates a new GetIntegrationTestBody object.
func NewGetIntegrationTestBody() *GetIntegrationTestBody {
	return &GetIntegrationTestBody{}
}
