package definition

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/query/v0alpha1/template"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryTypeDefinition struct {
	metav1.TypeMeta `json:",inline"`

	// The name (uid) will include both the query type and a version identifier
	// It must be a valid k8s name, so version identifiers will be the suffix
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// Defines valid properties for the query object
	Spec QueryTypeSpec `json:"spec,omitempty"`
}

// The ObjectMeta.Name field defines the
type QueryTypeSpec struct {
	// Describe whe the query type is for
	Description string `json:"description,omitempty"`

	// Versions (most recent first)
	Versions []QueryTypeVersion `json:"versions"`

	PreferredVersion string `json:"preferredVersion,omitempty"`
}

// The ObjectMeta.Name field defines the
type QueryTypeVersion struct {
	Version string `json:"version,omitempty"`

	// The OpenAPI definition for non-common field fields
	// Only defines the non-core fields!
	// https://github.com/kubernetes/apiextensions-apiserver/blob/v0.29.1/pkg/apis/apiextensions/types_jsonschema.go#L40
	Schema common.Unstructured `json:"schema"`

	// Examples (include a wrapper)
	Examples []template.QueryTemplate `json:"examples,omitempty"`

	// What changed from the previous version
	// for the full history see git!
	Changelog []string `json:"changelog,omitempty"`
}

// List of datasource plugins
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryTypeDefinitionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []QueryTypeDefinition `json:"items,omitempty"`
}
