package resource

import (
	"context"

	"github.com/grafana/authlib/authz"
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

type ResourceIndex interface {
	// Add a document to the index.  Note it may not be searchable until after flush is called
	Write(doc IndexableDocument) error

	// Mark a resource as deleted.  Note it may not be searchable until after flush is called
	Delete(key *ResourceKey) error

	// Make sure any changes to the index are flushed and available in the next search/origin calls
	Flush() error

	// Search within a namespaced resource
	Search(ctx context.Context, access authz.AccessClient, req *ResourceSearchRequest) (*ResourceSearchResponse, error)

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
