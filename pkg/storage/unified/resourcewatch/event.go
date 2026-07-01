// Package resourcewatch defines the NATS wire contract for watching Kubernetes
// resources: the subject (see subject.go) and the envelope (see event.go),
// shared by publishers and consumers so both derive the same subject and payload.
//
// The envelope carries only version-agnostic metadata (group, resource,
// namespace, name, resourceVersion, folder), never the object itself: the
// publisher announces a change once and each consumer re-fetches the object via
// GET at its own API version, so the wire format is version-agnostic with no
// per-version fan-out. It is serialized as the resourcepb.WatchNotification
// proto — the actual wire contract — of which Event is the ergonomic Go form.
package resourcewatch

import (
	"fmt"

	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// EventType is the kind of change a notification announces. Its values mirror
// the verbs of k8s.io/apimachinery watch.EventType so consumers map them onto a
// watch stream without translation, but it is defined here to keep the contract
// free of a k8s watch dependency.
type EventType string

const (
	Added    EventType = "ADDED"
	Modified EventType = "MODIFIED"
	Deleted  EventType = "DELETED"
)

// Event is the Go form of the resourcepb.WatchNotification envelope published on
// a resource subject; Marshal/Unmarshal round-trip through the proto.
type Event struct {
	Type      EventType
	Group     string
	Resource  string
	Namespace string
	Name      string
	// ResourceVersion is an int64 to match how unified storage issues it. It is
	// meaningful only for equality/ordering as understood by the issuing
	// storage, not as an arithmetic quantity.
	ResourceVersion int64
	Folder          string
}

// An unmapped verb becomes UNKNOWN so an unset/garbage type never masquerades
// as a real change; the reverse yields the empty EventType.
var eventTypeToProto = map[EventType]resourcepb.WatchNotification_Type{
	Added:    resourcepb.WatchNotification_ADDED,
	Modified: resourcepb.WatchNotification_MODIFIED,
	Deleted:  resourcepb.WatchNotification_DELETED,
}

var eventTypeFromProto = map[resourcepb.WatchNotification_Type]EventType{
	resourcepb.WatchNotification_ADDED:    Added,
	resourcepb.WatchNotification_MODIFIED: Modified,
	resourcepb.WatchNotification_DELETED:  Deleted,
}

// Marshal encodes the event as a resourcepb.WatchNotification for publishing.
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

// UnmarshalEvent decodes a proto-encoded WatchNotification back into an Event.
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
