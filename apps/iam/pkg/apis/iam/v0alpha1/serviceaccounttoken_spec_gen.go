// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

// +k8s:openapi-gen=true
type ServiceAccountTokenSpec struct {
	Name     string    `json:"name"`
	Revoked  bool      `json:"revoked"`
	Expires  time.Time `json:"expires"`
	LastUsed time.Time `json:"lastUsed"`
	Created  time.Time `json:"created"`
}

// NewServiceAccountTokenSpec creates a new ServiceAccountTokenSpec object.
func NewServiceAccountTokenSpec() *ServiceAccountTokenSpec {
	return &ServiceAccountTokenSpec{}
}
