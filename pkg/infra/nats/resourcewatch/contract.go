// Package resourcewatch defines the NATS wire contract for watching Kubernetes
// resources: the subject a resource's change notifications are published on, and
// the envelope that carries each one. It is the single source of truth shared by
// publishers and consumers so both derive the same subject and payload.
//
// The envelope carries only version-agnostic metadata (group, resource,
// namespace, name, resourceVersion, folder), never the object itself. This is
// deliberate: a single publisher can announce a change once, and each consumer
// materializes the object by issuing a GET (or Search) at whatever API version
// it needs. Conversion happens through the apiserver on that GET, so the wire
// format never has to know about versions and there is no per-version fan-out.
//
// The contract is generic over any group/version/resource; it does not know
// about any particular API. It lives here, under pkg/infra/nats, for now because
// it is owned alongside the NATS platform rather than by any one consumer.
package resourcewatch

import (
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

// allNamespaces is the NATS single-token wildcard ("*") used in the namespace
// position to watch every namespace's notifications for a resource.
const allNamespaces = "*"

// Subject returns the NATS subject that carries change notifications for a
// resource type within a namespace, as the dotted tokens
//
//	{group}.{namespace}.{resource}
//
// The version is intentionally absent: notifications are version-agnostic and a
// consumer resolves the object at its own version via GET, so a single subject
// serves every version. An empty namespace yields the "*" single-token wildcard
// in the namespace position, so a consumer can watch every namespace's
// notifications for the resource (Grafana namespaces have no dots, so a concrete
// namespace is always exactly one token and never bleeds into the wildcard).
//
// The group keeps its dots and therefore spans several tokens
// (provisioning.grafana.app -> three tokens); publisher and consumer build the
// subject the same way from the same GVR, so this is consistent on both sides.
func Subject(gvr schema.GroupVersionResource, namespace string) string {
	ns := namespace
	if ns == "" {
		ns = allNamespaces
	}
	return strings.Join([]string{
		gvr.Group,
		ns,
		gvr.Resource,
	}, ".")
}

// Event is the wire envelope published on a resource subject. It carries only
// the metadata needed to identify what changed; the consumer fetches the object
// itself. Type is one of the watch.EventType verbs (ADDED, MODIFIED, DELETED,
// BOOKMARK).
type Event struct {
	Type            string `json:"type"`
	Group           string `json:"group"`
	Resource        string `json:"resource"`
	Namespace       string `json:"namespace"`
	Name            string `json:"name"`
	ResourceVersion string `json:"resourceVersion"`
	Folder          string `json:"folder,omitempty"`
}
