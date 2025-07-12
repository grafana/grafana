package v0alpha1

import (
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

// Optional extensions for an explicit datasource type
type DataSourceOpenAPIExtension struct {
	// When specified, this will replace the default spec
	DataSourceSpec *spec.Schema `json:"spec,omitempty"`

	// The raw value is never returned in an API response
	SecureValues []SecureValueInfo `json:"secureValues"`

	// Additional Schemas added to the response
	Schemas map[string]*spec.Schema `json:"schemas,omitempty"`

	// Resource routes
	Routes map[string]*spec3.Path `json:"routes,omitempty"`

	// Proxy routes
	Proxy map[string]*spec3.Path `json:"proxy,omitempty"`
}

type SecureValueInfo struct {
	// The key
	Key string `json:"string"`

	// Description
	Description string `json:"description,omitempty"`

	// Required secure values
	Required bool `json:"required,omitempty"`
}
