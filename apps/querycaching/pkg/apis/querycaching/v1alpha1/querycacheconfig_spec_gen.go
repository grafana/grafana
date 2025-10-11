// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type QueryCacheConfigSpec struct {
	UseDefaultTtl  bool  `json:"use_default_ttl"`
	TtlMs          int64 `json:"ttl_ms"`
	TtlResourcesMs int64 `json:"ttl_resources_ms"`
	Enabled        bool  `json:"enabled"`
}

// NewQueryCacheConfigSpec creates a new QueryCacheConfigSpec object.
func NewQueryCacheConfigSpec() *QueryCacheConfigSpec {
	return &QueryCacheConfigSpec{}
}
