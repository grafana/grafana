package resourcewatch

import (
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

// subjectRoot prefixes every resource-change subject. It isolates this traffic
// from the rest of the bus, so a ">" tail wildcard can never deliver unrelated
// messages (e.g. $SYS.*), and its version token lets the layout below change
// without a flag day: publisher and consumers move root by root.
const subjectRoot = "us.watch.v1"

// anyToken is the NATS single-token wildcard, used in the namespace or resource
// position to match every value of it.
const anyToken = "*"

// coreGroup stands in for the empty (core) group, which would otherwise yield an
// empty token. The leading underscore is illegal in a DNS label and therefore in
// an API group, so it cannot collide with a real group.
const coreGroup = "_core"

// SubjectAllResources matches every Subject(...), whatever the group's token
// count. It is confined to subjectRoot, so it is a firehose over resource
// notifications only.
const SubjectAllResources = subjectRoot + ".>"

// Subject returns the NATS subject that carries change notifications for a
// resource type within a namespace, as the dotted tokens
//
//	us.watch.v1.{group}.{namespace}.{resource}
//
// The components follow the Kubernetes path order
// (/apis/{group}/{version}/namespaces/{namespace}/{resource}), so a subject in a
// log line reads the same way as the API path it came from. The group keeps its
// own dots and so spans a variable number of tokens; nothing depends on a fixed
// offset, because publisher, consumer and the us-nats auth callout all compose
// the subject from a group they know textually, using only the single-token "*"
// wildcard. Namespace and resource are always exactly one token: Grafana
// namespaces and resource names contain no dots.
//
// The version is intentionally absent: notifications are version-agnostic and a
// consumer resolves the object at its own version via GET, so a single subject
// serves every version. An empty namespace or resource yields the single-token
// wildcard in its position, so a consumer can watch every namespace, or every
// resource of a group.
func Subject(gvr schema.GroupVersionResource, namespace string) string {
	group := gvr.Group
	if group == "" {
		group = coreGroup
	}
	if namespace == "" {
		namespace = anyToken
	}
	resource := gvr.Resource
	if resource == "" {
		resource = anyToken
	}
	return strings.Join([]string{subjectRoot, group, namespace, resource}, ".")
}

// ParseSubject decomposes a subject produced by Subject back into its
// components. It is the inverse of Subject: the core group's "_core" token maps
// back to the empty group, and a "*" in the namespace or resource position is
// returned verbatim, so Subject(ParseSubject(s)) == s.
//
// The group's own dots make its token count variable, but namespace and resource
// are always exactly one token and always last, so the split is taken from the
// tail rather than a fixed offset. ok is false for anything that is not a
// Subject: a different root, a ">" tail (SubjectAllResources cannot be
// decomposed — it names no single group), or too few tokens to fill all three
// positions.
//
// It exists for the reverse direction of the publish path: NATS reports a
// publish permissions violation asynchronously, carrying only the subject text,
// so the group and resource behind a rejected publish have to be recovered from
// the subject itself.
func ParseSubject(subject string) (group, namespace, resource string, ok bool) {
	rest, found := strings.CutPrefix(subject, subjectRoot+".")
	if !found {
		return "", "", "", false
	}
	tokens := strings.Split(rest, ".")
	// One token each for namespace and resource, at least one for the group.
	if len(tokens) < 3 {
		return "", "", "", false
	}
	for _, token := range tokens {
		if token == "" || token == ">" {
			return "", "", "", false
		}
	}
	group = strings.Join(tokens[:len(tokens)-2], ".")
	if group == coreGroup {
		group = ""
	}
	return group, tokens[len(tokens)-2], tokens[len(tokens)-1], true
}
