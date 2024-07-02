package resource

import (
	context "context"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type WriteEvent struct {
	EventID    int64
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

	// The resource version
	ResourceVersion int64

	// Timestamp when the event is created
	Timestamp int64
}

// A function to write events
type EventAppender = func(context.Context, *WriteEvent) (int64, error)

type writeEventBuilder struct {
	EventID int64
	Key     *ResourceKey // the request key
	Type    WatchEvent_Type

	Requester identity.Requester
	Object    *unstructured.Unstructured

	// Access the raw metadata values
	Meta    utils.GrafanaMetaAccessor
	OldMeta utils.GrafanaMetaAccessor
}

func newEventFromBytes(value, oldValue []byte) (*writeEventBuilder, error) {
	builder := &writeEventBuilder{
		Object: &unstructured.Unstructured{},
	}
	err := builder.Object.UnmarshalJSON(value)
	if err != nil {
		return nil, err
	}
	builder.Meta, err = utils.MetaAccessor(builder.Object)
	if err != nil {
		return nil, err
	}

	if oldValue == nil {
		builder.Type = WatchEvent_ADDED
	} else {
		builder.Type = WatchEvent_MODIFIED

		temp := &unstructured.Unstructured{}
		err = temp.UnmarshalJSON(oldValue)
		if err != nil {
			return nil, err
		}
		builder.OldMeta, err = utils.MetaAccessor(temp)
		if err != nil {
			return nil, err
		}
	}
	return builder, nil
}

func (b *writeEventBuilder) toEvent() (event WriteEvent, err error) {
	event.EventID = b.EventID
	event.Key = b.Key
	event.Type = b.Type
	event.ObjectOld = b.OldMeta
	event.Object = b.Meta
	event.Value, err = b.Object.MarshalJSON()
	return // includes the named values
}
