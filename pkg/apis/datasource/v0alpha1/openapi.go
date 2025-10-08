package v0alpha1

import (
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

// Optional extensions for an explicit datasource type
// NOTE: the properties from this structure will be populated by reading an app-sdk manifest.json
type DataSourceOpenAPIExtension struct {
	// When specified, this will replace the default spec
	DataSourceSpec *spec.Schema `json:"spec,omitempty"`

	// Define which secure values are required
	SecureValues []SecureValueInfo `json:"secureValues"`

	// Additional Schemas added to the response
	Schemas map[string]*spec.Schema `json:"schemas,omitempty"`

	// TODO: define query types dynamically here (currently hardcoded)
	// Queries *queryV0.QueryTypeDefinitionList `json:"queries,omitempty"`

	// Resource routes -- the paths exposed under:
	// {group}/{version}/namespaces/{ns}/datasource/{name}/resource/{route}
	Routes map[string]*spec3.Path `json:"routes,omitempty"`

	// Proxy routes -- the paths exposed under:
	// {group}/{version}/namespaces/{ns}/datasource/{name}/proxy/{proxy}
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
