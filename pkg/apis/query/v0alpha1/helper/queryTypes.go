package helper

import (
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

// +k8s:deepcopy-gen=false
// +k8s:openapi-gen=false
// +k8s:defaulter-gen=false
type QueryTypeSupport[Q any] interface {
	// The base queryType for all versions
	QueryType() string

	// Possible query type versions
	Versions() []query.QueryTypeDefinition

	// Parse and validate the raw query
	// When the input queryType includes a version suffix, it will be
	ReadQuery(generic query.GenericDataQuery, version string) (Q, error)
}

// // QueryTypeRegistry manages supported queries within an API
// // +k8s:deepcopy-gen=false
// // +k8s:openapi-gen=false
// // +k8s:defaulter-gen=false
// type QueryTypeRegistry[Q any] struct {
// 	types   map[string]QueryTypeSupport[Q]
// 	creator func() Q
// }

// func (r *QueryTypeRegistry[Q]) ReadQuery(generic query.GenericDataQuery) (Q, error) {
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

// func (r *QueryTypeRegistry[Q]) Definitions() query.QueryTypeDefinitionList {
// 	all := query.QueryTypeDefinitionList{}
// 	for _, qt := range r.types {
// 		all.Items = append(all.Items, qt.Versions()...)
// 	}
// 	return all
// }
