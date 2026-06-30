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
// The contract is generic over any group/version/resource; it does not know
// about any particular API. It lives under pkg/storage/unified because it is
// expressed in unified-storage terms — group/resource and an opaque
// resourceVersion — and is shared by both sides of the watch, like the other
// storage contracts.
package resourcewatch

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
// itself.
type Event struct {
	Type      EventType `json:"type"`
	Group     string    `json:"group"`
	Resource  string    `json:"resource"`
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	// ResourceVersion is an int64 to match how unified storage issues it on the
	// kv/storage side (and in resourcepb). It is meaningful only for
	// equality/ordering as understood by the issuing storage, not as an
	// arithmetic quantity.
	ResourceVersion int64  `json:"resourceVersion"`
	Folder          string `json:"folder,omitempty"`
}
