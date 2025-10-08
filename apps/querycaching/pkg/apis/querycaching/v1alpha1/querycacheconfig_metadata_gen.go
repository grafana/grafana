// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

import (
	time "time"
)

// metadata contains embedded CommonMetadata and can be extended with custom string fields
// TODO: use CommonMetadata instead of redefining here; currently needs to be defined here
// without external reference as using the CommonMetadata reference breaks thema codegen.
type QueryCacheConfigMetadata struct {
	// All extensions to this metadata need to have string values (for APIServer encoding-to-annotations purposes)
	// Can't use this as it's not yet enforced CUE:
	// ...string
	// Have to do this gnarly regex instead
	Name              string            `json:"name"`
	UpdateTimestamp   time.Time         `json:"updateTimestamp"`
	CreatedBy         string            `json:"createdBy"`
	Uid               string            `json:"uid"`
	CreationTimestamp time.Time         `json:"creationTimestamp"`
	DeletionTimestamp *time.Time        `json:"deletionTimestamp,omitempty"`
	Finalizers        []string          `json:"finalizers"`
	ResourceVersion   string            `json:"resourceVersion"`
	Generation        int64             `json:"generation"`
	UpdatedBy         string            `json:"updatedBy"`
	Labels            map[string]string `json:"labels"`
}

// NewQueryCacheConfigMetadata creates a new QueryCacheConfigMetadata object.
func NewQueryCacheConfigMetadata() *QueryCacheConfigMetadata {
	return &QueryCacheConfigMetadata{
		Finalizers: []string{},
		Labels:     map[string]string{},
	}
}
