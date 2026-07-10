package resourcewatch

import (
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

// allNamespaces is the NATS single-token wildcard ("*") used in the namespace
// position to watch every namespace's notifications for a resource.
const allNamespaces = "*"

// SubjectAll is the NATS multi-token wildcard (">"), matching every Subject(...)
// value regardless of group, namespace, or resource. A consumer that needs the
// full change stream (not one resource type) subscribes to this.
const SubjectAll = ">"

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
