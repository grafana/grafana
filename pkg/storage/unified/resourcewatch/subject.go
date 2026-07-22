package resourcewatch

import (
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

// allNamespaces is the NATS single-token wildcard ("*") used in the namespace
// position to watch every namespace's notifications for a resource.
const allNamespaces = "*"

// SubjectAllResources matches every Subject(...) whose group is a single-token
// grafana.app group ({group}.grafana.app.{namespace}.{resource}). Single-token
// "*" wildcards keep out non-resource bus traffic (e.g. $SYS.*) that a ">"
// firehose would deliver and fail to unmarshal. Groups with >1 token before
// .grafana.app are not matched.
const SubjectAllResources = "*.grafana.app.*.*"

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
