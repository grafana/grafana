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
	// DiscriminatorField is the field used to link behavior to this specific
	// query type.  It is typically "queryType", but can be another field if necessary
	DiscriminatorField string `json:"discriminatorField,omitempty"`

	// The discriminator value
	DiscriminatorValue string `json:"discriminatorValue,omitempty"`

	// Describe whe the query type is for
	Description string `json:"description,omitempty"`

	// The query schema represents the properties that can be sent to the API
	// In many cases, this may be the same properties that are saved in a dashboard
	// In the case where the save model is different, we must also specify a save model
	QuerySchema json.RawMessage `json:"querySchema"`

	// The save model defines properties that can be saved into dashboard or similar
	// These values are processed by frontend components and then sent to the api
	// When specified, this schema will be used to validate saved objects rather than
	// the query schema
	SaveModel json.RawMessage `json:"saveModel,omitempty"`

	// Examples (include a wrapper) ideally a template!
	Examples []QueryExample `json:"examples,omitempty"`

	// Changelog defines the changed from the previous version
	// All changes in the same version *must* be backwards compatible
	// Only notable changes will be shown here, for the full version history see git!
	Changelog []string `json:"changelog,omitempty"`
}

type QueryExample struct {
	// Version identifier or empty if only one exists
	Name string `json:"name,omitempty"`

	// An example payload -- this should not require the frontend code to
	// pre-process anything
	QueryPayload json.RawMessage `json:"queryPayload,omitempty"`

	// An example save model -- this will require frontend code to convert it
	// into a valid query payload
	SaveModel json.RawMessage `json:"saveModel,omitempty"`
}
