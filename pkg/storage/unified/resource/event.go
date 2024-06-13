package resource

import (
	context "context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type WriteEvent struct {
	EventID    int64
	Key        *ResourceKey // the request key
	Requester  identity.Requester
	Operation  ResourceOperation
	PreviousRV int64 // only for Update+Delete

	// The raw JSON payload
	// NOTE, this is never mutated, only parsed and validated
	Value json.RawMessage

	// Access the raw metadata values
	Object    utils.GrafanaMetaAccessor
	OldObject utils.GrafanaMetaAccessor

	// Optionally link to a
	Blob *LinkBlob

	// Change metadata (useful?)
	FolderChanged bool
}

// A function to write events
type EventAppender = func(context.Context, *WriteEvent) (int64, error)
