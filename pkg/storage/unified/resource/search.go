package resource

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

// IndexableDocument can be written to a ResourceIndex
type IndexableDocument interface {
	// The ID must be unique across everything in the index
	GetID() string
}

// Convert raw resource bytes into an IndexableDocument
type DocumentBuilder interface {
	// Convert raw bytes into an document that can be written
	BuildDocument(ctx context.Context, key *ResourceKey, rv int64, value []byte) (IndexableDocument, error)
}

// Register how documents can be built for a resource
type DocumentBuilderInfo struct {
	// The target resource (empty will be used to match anything)
	GroupResource schema.GroupResource

	// simple/static builders that do not depend on the environment can be declared once
	Builder DocumentBuilder

	// Complicated builders (eg dashboards!) will be declared dynamically and managed by the ResourceServer
	Namespaced func(ctx context.Context, namespace string, blob BlobSupport) (DocumentBuilder, error)
}
