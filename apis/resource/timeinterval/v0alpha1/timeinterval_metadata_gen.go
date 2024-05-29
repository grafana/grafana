package v0alpha1

import (
	"time"
)

// Metadata defines model for Metadata.
type Metadata struct {
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
type KubeObjectMetadata struct {
	CreationTimestamp time.Time         `json:"creationTimestamp"`
	DeletionTimestamp *time.Time        `json:"deletionTimestamp,omitempty"`
	Finalizers        []string          `json:"finalizers"`
	Generation        int64             `json:"generation"`
	Labels            map[string]string `json:"labels"`
	ResourceVersion   string            `json:"resourceVersion"`
	Uid               string            `json:"uid"`
}
