// +k8s:deepcopy-gen=package
// +k8s:openapi-gen=true
// +groupName=search.grafana.app

// Package v0alpha1 holds the request/response envelope types for the
// per-resource search, trash and hybrid search endpoints (POST
// .../{resource}/search, .../{resource}/trash and .../{resource}/search/hybrid),
// and for the global search across resource types (POST
// .../namespaces/{namespace}/global/search), which shares the search envelope.
// Global hybrid search (POST .../namespaces/{namespace}/global/search/hybrid)
// shares the hybrid search envelope. Grafana's HTTP route uses configured
// resource defaults when the request omits resources or supplies an empty list.
//
// These are non-stored, RPC-style types: there is no stored object to GET and
// no conversion machinery between envelope versions. The envelope group
// (search.grafana.app) is deliberately separate from the kind being searched
// so the request/response schema can evolve independently of any searched
// kind.
package v0alpha1
