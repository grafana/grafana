package resource

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/authlib/authz"
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

type ResourceIndex interface {
	// Add a document to the index.  Note it may not be searchable until after flush is called
	Write(doc IndexableDocument) error

	// Mark a resource as deleted.  Note it may not be searchable until after flush is called
	Delete(key *ResourceKey) error

	// Make sure any changes to the index are flushed and available in the next search/origin calls
	Flush() error

	// Search within a namespaced resource
	// When working with federated queries, the additional indexes will be passed in explicitly
	Search(ctx context.Context, access authz.AccessClient, req *ResourceSearchRequest, federate []ResourceIndex) (*ResourceSearchResponse, error)

	// Execute an origin query -- access control is not not checked for each item
	// NOTE: this will likely be used for provisioning, or it will be removed
	Origin(ctx context.Context, req *OriginRequest) (*OriginResponse, error)
}

type NamespacedResource struct {
	Namespace string
	Group     string
	Resource  string
}

// All fields are set
func (s *NamespacedResource) Valid() bool {
	return s.Namespace != "" && s.Group != "" && s.Resource != ""
}

// SearchBackend contains the technology specific logic to support search
type SearchBackend interface {
	// This will return nil if the key does not exist
	GetIndex(ctx context.Context, key NamespacedResource) (ResourceIndex, error)

	// Build an index from scratch
	BuildIndex(ctx context.Context,
		key NamespacedResource,

		// When the size is known, it will be passed along here
		// Depending on the size, the backend may choose different options (eg: memory vs disk)
		size int64,

		// The last known resource version (can be used to know that nothing has changed)
		resourceVersion int64,

		// The builder will write all documents before returning
		builder func(index ResourceIndex) (int64, error),
	) (ResourceIndex, error)
}
