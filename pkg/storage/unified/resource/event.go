package resource

import (
	context "context"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type WriteEvent struct {
	Type       WatchEvent_Type // ADDED, MODIFIED, DELETED
	Key        *ResourceKey    // the request key
	PreviousRV int64           // only for Update+Delete

	// The json payload (without resourceVersion)
	Value []byte

	// Access real fields
	Object utils.GrafanaMetaAccessor

	// Access to the old metadata
	ObjectOld utils.GrafanaMetaAccessor
}

// WriteEvents after they include a resource version
type WrittenEvent struct {
	WriteEvent
	// Metadata
	Folder string

	// The resource version
	ResourceVersion int64

	// Timestamp when the event is created
	Timestamp int64
}

// A function to write events
type EventAppender = func(context.Context, *WriteEvent) (int64, error)
