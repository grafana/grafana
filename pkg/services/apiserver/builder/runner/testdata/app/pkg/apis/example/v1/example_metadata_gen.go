package v1

import (
	"time"
)

// ExampleMetadata defines model for ExampleMetadata.
type ExampleMetadata struct {
	CreatedBy         string            `json:"createdBy"`
	CreationTimestamp time.Time         `json:"creationTimestamp"`
	DeletionTimestamp *time.Time        `json:"deletionTimestamp,omitempty"`
	Finalizers        []string          `json:"finalizers"`
	Generation        int64             `json:"generation"`
	Labels            map[string]string `json:"labels"`
	ResourceVersion   string            `json:"resourceVersion"`
	Uid               string            `json:"uid"`
	UpdateTimestamp   time.Time         `json:"updateTimestamp"`
	UpdatedBy         string            `json:"updatedBy"`
}

// _kubeObjectMetadata is metadata found in a kubernetes object's metadata field.
// It is not exhaustive and only includes fields which may be relevant to a kind's implementation,
// As it is also intended to be generic enough to function with any API Server.
type ExampleKubeObjectMetadata struct {
	CreationTimestamp time.Time         `json:"creationTimestamp"`
	DeletionTimestamp *time.Time        `json:"deletionTimestamp,omitempty"`
	Finalizers        []string          `json:"finalizers"`
	Generation        int64             `json:"generation"`
	Labels            map[string]string `json:"labels"`
	ResourceVersion   string            `json:"resourceVersion"`
	Uid               string            `json:"uid"`
}
