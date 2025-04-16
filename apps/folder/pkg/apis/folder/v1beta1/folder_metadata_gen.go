// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

import (
	time "time"
)

// metadata contains embedded CommonMetadata and can be extended with custom string fields
// TODO: use CommonMetadata instead of redefining here; currently needs to be defined here
// without external reference as using the CommonMetadata reference breaks thema codegen.
type FolderMetadata struct {
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

// NewFolderMetadata creates a new FolderMetadata object.
func NewFolderMetadata() *FolderMetadata {
	return &FolderMetadata{}
}
