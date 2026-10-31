package converge

import (
	"strconv"
	"strings"
)

// OpKind is the kind of change an operation makes.
type OpKind uint8

const (
	// OpCreate writes an entity the target does not hold.
	OpCreate OpKind = iota
	// OpUpdate rewrites an entity whose content differs from the declaration.
	OpUpdate
	// OpDelete removes an entity nothing declares.
	OpDelete
	// OpMove re-keys an entity while preserving its identity. It is an
	// optimisation of delete-then-create and must be state-equivalent to it:
	// a planner that never emits OpMove reaches the same target content,
	// differing only in which identities survive.
	OpMove
	// OpEnsureContainer makes a container exist at Key with Identity. It is
	// idempotent by contract: the actuator may be asked to ensure a container
	// that already exists.
	OpEnsureContainer
	// OpRemoveContainer removes a container. The plan guarantees it is emptied
	// first.
	OpRemoveContainer
)

func (k OpKind) String() string {
	switch k {
	case OpCreate:
		return "create"
	case OpUpdate:
		return "update"
	case OpDelete:
		return "delete"
	case OpMove:
		return "move"
	case OpEnsureContainer:
		return "ensure-container"
	case OpRemoveContainer:
		return "remove-container"
	}
	return "unknown"
}

// IsContainerOp reports whether k operates on a container rather than an entity.
func (k OpKind) IsContainerOp() bool {
	return k == OpEnsureContainer || k == OpRemoveContainer
}

// OpRef names an operation stably within a plan. It is derived from the
// operation's kind, keys and identity, never from its position, so it survives
// re-planning and round-trips through serialisation.
type OpRef string

// GroupID marks a set of operations that must be executed together or not at
// all. Container re-identification forms one: a half-applied re-identification
// leaves children pointing at a container that is about to disappear.
type GroupID string

// Op is one change to the target. It carries everything a caller needs to
// authorise, dry-run, display or execute it without consulting the planner's
// inputs again.
type Op struct {
	Kind OpKind

	// Key is the destination: the key the entity or container will occupy.
	Key Key

	// From is the key an [OpMove] leaves. Empty for every other kind.
	From Key

	// Identity is known for every operation on something the target already
	// holds, and for container ensures. It is empty for [OpCreate], where the
	// target assigns one.
	//
	// IdentityProvenance records where Identity came from, and carries the same
	// warning as ContainerProvenance: a container identity the source asserted
	// is only as trustworthy as the version it was read from. It is the
	// container's own identity that is described here, never its parent's.
	Identity           Identity
	IdentityProvenance Provenance

	// Fingerprint is the content the operation should leave in place. Empty
	// for deletions and container operations.
	Fingerprint Fingerprint

	// Reason explains operations that are not self-evident from their kind:
	// duplicate cleanup, re-parenting, container re-identification.
	Reason Reason

	// Container is the container this operation resolves into, with the
	// identity that container will have and the provenance of that identity.
	//
	// A veto pass must consult ContainerProvenance. An identity the source
	// asserted at the planned version is only as trustworthy as that version:
	// authorising against one lets a source have its permission check
	// evaluated against an object it does not own. See [Provenance].
	Container           Key
	ContainerIdentity   Identity
	ContainerProvenance Provenance

	// Group, when set, marks this operation as part of an all-or-nothing set.
	Group GroupID

	// DependsOn lists the operations that must complete before this one. It is
	// the ordering edge set made explicit, and it is what lets [Restrict] and
	// the apply helper compute a dependent closure without rebuilding the
	// graph.
	DependsOn []OpRef
}

// Ref returns the operation's stable reference.
//
// The fields are length-prefixed rather than joined by a separator. Keys and
// identities are opaque and may contain any character, so a separator makes
// distinct operations collide: a move from "a|b" to "c" and one from "a" to
// "b|c" would share a reference, and the maps keyed by it — byRef lookups,
// execution status, vetoes — would conflate them.
func (o Op) Ref() OpRef {
	var b strings.Builder
	b.WriteString(o.Kind.String())
	for _, field := range []string{string(o.From), string(o.Key), string(o.Identity)} {
		b.WriteByte('|')
		b.WriteString(strconv.Itoa(len(field)))
		b.WriteByte(':')
		b.WriteString(field)
	}
	return OpRef(b.String())
}
