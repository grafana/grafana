package v0alpha1

import (
	"encoding/json"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Generic query request with shared time across all values
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryTypeDefinition struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec QueryTypeDefinitionSpec `json:"spec,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryTypeDefinitionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []QueryTypeDefinition `json:"items,omitempty"`
}

type QueryTypeDefinitionSpec struct {
	// The query type value
	// NOTE: this must be a k8s compatible name
	Name string `json:"name,omitempty"` // must be k8s name? compatible

	// DiscriminatorField is the field used to link behavior to this specific
	// query type.  It is typically "queryType", but can be another field if necessary
	DiscriminatorField string `json:"discriminatorField,omitempty"`

	// Describe whe the query type is for
	Description string `json:"description,omitempty"`

	// Versions (most recent first)
	Versions []QueryTypeVersion `json:"versions"`

	// When multiple versions exist, this is the preferredVersion
	PreferredVersion string `json:"preferredVersion,omitempty"`
}

type QueryTypeVersion struct {
	// Version identifier or empty if only one exists
	Version string `json:"version,omitempty"`

	// The JSONSchema definition for the non-common fields
	Schema json.RawMessage `json:"schema"`

	// Example queries (ideally this could be a template)
	Examples []QueryExample `json:"examples,omitempty"`

	// Changelog defines the changed from the previous version
	// All changes in the same version *must* be backwards compatible
	// Only notable changes will be shown here, for the full version history see git!
	Changelog []string `json:"changelog,omitempty"`
}

type QueryExample struct {
	// Version identifier or empty if only one exists
	Name string `json:"name,omitempty"`

	// An example query
	Query json.RawMessage `json:"query"`
}
