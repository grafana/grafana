package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
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
	Examples []ExampleInfo `json:"examples,omitempty"`

	// What changed from the previous version
	// for the full history see git!
	Changelog []string `json:"changelog,omitempty"`
}

// TODO -- use the template defined in peakq!!!
type ExampleInfo struct {
	Name string `json:"name,omitempty"`

	Description string `json:"description,omitempty"`

	Query GenericDataQuery `json:"query,omitempty"`
}

// List of datasource plugins
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryTypeDefinitionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []QueryTypeDefinition `json:"items,omitempty"`
}

// +k8s:deepcopy-gen=false
// +k8s:openapi-gen=false
// +k8s:defaulter-gen=false
type QueryTypeSupport[Q any] interface {
	// The base queryType for all versions
	QueryType() string

	// Possible query type versions
	Versions() []QueryTypeDefinition

	// Parse and validate the raw query
	// When the input queryType includes a version suffix, it will be
	ReadQuery(generic GenericDataQuery, version string) (Q, error)
}

// // QueryTypeRegistry manages supported queries within an API
// // +k8s:deepcopy-gen=false
// type QueryTypeRegistry[Q any] struct {
// 	types   map[string]QueryTypeSupport[Q]
// 	creator func() Q
// }

// func (r *QueryTypeRegistry[Q]) ReadQuery(generic GenericDataQuery) (Q, error) {
// 	base := generic.QueryType
// 	version := ""
// 	parts := strings.SplitN(base, "/", 2)
// 	if len(parts) == 2 {
// 		base = parts[0]
// 		version = parts[1]
// 	}

// 	qt, ok := r.types[base]
// 	if !ok {
// 		return r.creator(), fmt.Errorf("unknown query type")
// 	}
// 	return qt.ReadQuery(generic, version)
// }

// func (r *QueryTypeRegistry[Q]) Definitions() QueryTypeDefinitionList {
// 	all := QueryTypeDefinitionList{}
// 	for _, qt := range r.types {
// 		all.Items = append(all.Items, qt.Versions()...)
// 	}
// 	return all
// }
