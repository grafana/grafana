// Package resourcewatch defines the NATS wire contract for watching Kubernetes
// resources: the subject a resource's change notifications are published on
// (see subject.go), and the envelope that carries each one (see event.go). It
// is the single source of truth shared by publishers and consumers so both
// derive the same subject and payload.
//
// The envelope carries only version-agnostic metadata (group, resource,
// namespace, name, resourceVersion, folder), never the object itself. This is
// deliberate: a single publisher can announce a change once, and each consumer
// materializes the object by issuing a GET (or Search) at whatever API version
// it needs. Conversion happens through the apiserver on that GET, so the wire
// format never has to know about versions and there is no per-version fan-out.
//
// The envelope is serialized as the resourcepb.WatchNotification protobuf
// message: the proto is the actual wire contract and Event is the ergonomic
// Go form of it, converted on Marshal/Unmarshal. It lives under
// pkg/storage/unified because it is expressed in unified-storage terms —
// group/resource and an opaque resourceVersion — and is shared by both sides of
// the watch, like the other storage contracts.
package resourcewatch

import (
	"fmt"

	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// EventType is the kind of change a notification announces. Its values mirror
// the verbs of k8s.io/apimachinery/pkg/watch.EventType so a consumer can map
// them onto a watch.Interface without translation, but it is defined here to
// keep the wire contract self-contained and free of a k8s watch dependency.
type EventType string

const (
	Added    EventType = "ADDED"
	Modified EventType = "MODIFIED"
	Deleted  EventType = "DELETED"
)

// Event is the wire envelope published on a resource subject. It carries only
// the metadata needed to identify what changed; the consumer fetches the object
// itself. It is the Go form of resourcepb.WatchNotification, which is the proto
// wire contract Marshal/Unmarshal round-trip through.
type Event struct {
	Type      EventType
	Group     string
	Resource  string
	Namespace string
	Name      string
	// ResourceVersion is an int64 to match how unified storage issues it on the
	// kv/storage side (and in resourcepb). It is meaningful only for
	// equality/ordering as understood by the issuing storage, not as an
	// arithmetic quantity.
	ResourceVersion int64
	Folder          string
}

// eventTypeToProto maps the k8s-style verb onto the WatchNotification enum. An
// unrecognized verb becomes UNKNOWN so an unset/garbage type never masquerades
// as a real change.
var eventTypeToProto = map[EventType]resourcepb.WatchNotification_Type{
	Added:    resourcepb.WatchNotification_ADDED,
	Modified: resourcepb.WatchNotification_MODIFIED,
	Deleted:  resourcepb.WatchNotification_DELETED,
}

// eventTypeFromProto is the inverse of eventTypeToProto; UNKNOWN (and anything
// unmapped) yields the empty EventType.
var eventTypeFromProto = map[resourcepb.WatchNotification_Type]EventType{
	resourcepb.WatchNotification_ADDED:    Added,
	resourcepb.WatchNotification_MODIFIED: Modified,
	resourcepb.WatchNotification_DELETED:  Deleted,
}

// Marshal encodes the event into the proto wire contract
// (resourcepb.WatchNotification) for publishing on a resource subject.
func (e Event) Marshal() ([]byte, error) {
	return proto.Marshal(&resourcepb.WatchNotification{
		Type:            eventTypeToProto[e.Type],
		Group:           e.Group,
		Resource:        e.Resource,
		Namespace:       e.Namespace,
		Name:            e.Name,
		ResourceVersion: e.ResourceVersion,
		Folder:          e.Folder,
	})
}

// UnmarshalEvent decodes a proto-encoded WatchNotification received on a
// resource subject back into an Event.
func UnmarshalEvent(data []byte) (Event, error) {
	var n resourcepb.WatchNotification
	if err := proto.Unmarshal(data, &n); err != nil {
		return Event{}, fmt.Errorf("unmarshal watch notification: %w", err)
	}
	return Event{
		Type:            eventTypeFromProto[n.GetType()],
		Group:           n.GetGroup(),
		Resource:        n.GetResource(),
		Namespace:       n.GetNamespace(),
		Name:            n.GetName(),
		ResourceVersion: n.GetResourceVersion(),
		Folder:          n.GetFolder(),
	}, nil
}
