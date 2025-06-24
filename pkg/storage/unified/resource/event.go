package resource

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type WriteEvent struct {
	Type       resourcepb.WatchEvent_Type // ADDED, MODIFIED, DELETED
	Key        *resourcepb.ResourceKey    // the request key
	PreviousRV int64                      // only for Update+Delete

	// GUID is optional and might be used when persisting an event.
	// It is always set by the resource server.
	GUID string

	// The json payload (without resourceVersion)
	Value []byte

	// Access real fields
	Object utils.GrafanaMetaAccessor

	// Access to the old metadata
	ObjectOld utils.GrafanaMetaAccessor
}

// WrittenEvent is a WriteEvent reported with a resource version.
type WrittenEvent struct {
	Type       resourcepb.WatchEvent_Type
	Key        *resourcepb.ResourceKey
	PreviousRV int64

	// The json payload (without resourceVersion)
	Value []byte

	// Metadata
	Folder string

	// The resource version.
	ResourceVersion int64

	// Timestamp when the event is created
	Timestamp int64
}

// EventAppender is a function to write events.
type EventAppender = func(context.Context, *WriteEvent) (int64, error)
