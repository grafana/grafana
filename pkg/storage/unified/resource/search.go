package resource

import (
	"context"
)

// Indexable values from a resource
// This will likely get more structure assigned as the requirements become more clear
type IndexableDocument interface {
	GetID() string
}

// Convert raw resource bytes into an IndexableDocument
type DocumentBuilder interface {
	// Convert raw bytes into an document that can be written
	BuildDocument(ctx context.Context, key *ResourceKey, rv int64, value []byte) (IndexableDocument, error)
}

// Each namespace may need to load something
type DocumentBuilderInfo struct {
	Group    string
	Resource string

	// When the builder does not depend on cached namespace data
	Builder DocumentBuilder

	// For complicated builders (eg dashboards!) we need to load on demand
	Namespaced func(ctx context.Context, namespace string, blob BlobSupport) (DocumentBuilder, error)
}
