package contract

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type ListIterator interface {
	// Next advances iterator and returns true if there is next value is available from the iterator.
	// Error() should be checked after every call of Next(), even when Next() returns true.
	Next() bool // sql.Rows

	// Error returns iterator error, if any. This should be checked after any Next() call.
	// (Some iterator implementations return true from Next, but also set the error at the same time).
	Error() error

	// ContinueToken returns the token that can be used to start iterating *after* this item
	ContinueToken() string

	// ResourceVersion of the current item
	ResourceVersion() int64

	// Namespace of the current item
	// Used for fast(er) authz filtering
	Namespace() string

	// Name of the current item
	// Used for fast(er) authz filtering
	Name() string

	// Folder of the current item
	// Used for fast(er) authz filtering
	Folder() string

	// Value for the current item
	Value() []byte
}

type BackendReadResponse struct {
	// Metadata
	Key    *resourcepb.ResourceKey
	Folder string

	// GUID that is used internally
	GUID string
	// The new resource version
	ResourceVersion int64
	// The properties
	Value []byte
	// Error details
	Error *resourcepb.ErrorResult
}

// ErrBatchReadUnsupported signals the caller to fall back to per-resource reads.
// On the base interface, not a type assertion, so a wrapped backend keeps advertising it.
var ErrBatchReadUnsupported = errors.New("batch read not supported by this backend")

type ResourceLastImportTime struct {
	NamespacedResource
	LastImportTime time.Time
}

type ModifiedResource struct {
	Action          resourcepb.WatchEvent_Type
	Key             resourcepb.ResourceKey
	Value           []byte
	ResourceVersion int64
}

type ResourceStats struct {
	NamespacedResource

	Count           int64
	ResourceVersion int64
}

// This interface is not exposed to end users directly
// Access to this interface is already gated by access control
type BlobSupport interface {
	// Indicates if storage layer supports signed urls
	SupportsSignedURLs() bool

	// Get the raw blob bytes and metadata -- limited to protobuf message size
	// For larger payloads, we should use presigned URLs to upload from the client
	PutResourceBlob(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error)

	// Get blob contents.  When possible, this will return a signed URL
	// For large payloads, signed URLs are required to avoid protobuf message size limits
	GetResourceBlob(ctx context.Context, resource *resourcepb.ResourceKey, info *utils.BlobInfo, mustProxy bool) (*resourcepb.GetBlobResponse, error)

	// TODO? List+Delete?  This is for admin access
}
