// +k8s:deepcopy-gen=package
// +k8s:openapi-gen=true
// +groupName=search.grafana.app

// Package v0alpha1 holds the request/response envelope types for the
// per-resource search and trash endpoints (POST .../{resource}/search and
// POST .../{resource}/trash).
//
// These are non-stored, RPC-style types: there is no stored object to GET and
// no conversion machinery between envelope versions. The envelope group
// (search.grafana.app) is deliberately separate from the kind being searched
// so the request/response schema can evolve independently of any searched
// kind.
package v0alpha1 // import "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
