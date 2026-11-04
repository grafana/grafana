package converge

// ContainerConfig describes how containers are materialised.
//
// Containers are the reason this package exists. In a flat keyspace,
// reconciliation is a loop over a map. Here, the containers along a key are
// implied by the entities beneath them, may carry an identity the source pins,
// and can be re-identified, relocated with their identity intact, or left
// orphaned — and every ordering invariant in a plan exists to keep one from
// being removed out from under its contents.
//
// The zero value materialises nothing: only containers the source declares
// explicitly are planned.
type ContainerConfig struct {
	// Implied derives containers from the ancestry of entity keys, so that an
	// entity at "a/b/c.json" implies containers "a/" and "a/b/".
	Implied bool

	// MaxDepth caps container nesting, counting segments. Zero is unlimited.
	// A key implying a container deeper than this fails planning rather than
	// being silently truncated.
	MaxDepth int

	// FallbackIdentity derives the identity of a container the source does not
	// declare. It must be a pure function of the key.
	//
	// When nil, containers have no identity of their own: a container that
	// exists at the key satisfies the plan whatever identity it carries, and
	// re-identification never happens.
	FallbackIdentity func(Key) Identity

	// ContainerFor maps a source key to the container it declares, if any. It
	// exists only to expand hint closures, so that changing the key that pins
	// a container's identity re-examines the container itself.
	//
	// It does not affect full planning. A caller translates its own convention
	// — a metadata file, a sidecar, a naming rule — into a [Declaration] with
	// Container set and Key set to the container, so this package never needs
	// to know what that convention is.
	ContainerFor func(Key) (Key, bool)

	// ReparentDescendants extends re-identification to every descendant rather
	// than only direct children. Leave it false when the target addresses a
	// child by its parent's identity, so that re-parenting one level is
	// enough; set it when the target stores a full path per entity.
	ReparentDescendants bool
}

// containerWant is the desired state of one container.
type containerWant struct {
	identity    Identity
	provenance  Provenance
	fingerprint Fingerprint
	declared    bool
}

// identityMatters reports whether the plan can compare container identities at
// all. Without a fallback and without a declared identity there is nothing to
// compare, so existence is the only requirement.
func (w containerWant) identityMatters() bool { return w.identity != "" }

// mergeContainerDeclarations combines two declarations of one container.
//
// A refusal wins outright: if any declaration says the container cannot be
// held, it cannot be held. Otherwise the stated identity and content win over
// their absence, because a declaration that says nothing about a container is
// only asserting that it exists.
func mergeContainerDeclarations(existing, next Declaration) (Declaration, error) {
	if existing.Key == "" {
		return next, nil
	}
	if next.Verdict == Excluded {
		return next, nil
	}
	if existing.Verdict == Excluded {
		return existing, nil
	}

	// Two declarations that each state something, and state something
	// different, are a contradiction rather than a merge: letting the later one
	// win makes the plan depend on declaration order, which is the one thing
	// the planner promises it does not.
	if existing.Identity != "" && next.Identity != "" && existing.Identity != next.Identity {
		return Declaration{}, keyErr(existing.Key, ErrConflictingDeclaration)
	}
	if existing.Fingerprint != "" && next.Fingerprint != "" && existing.Fingerprint != next.Fingerprint {
		return Declaration{}, keyErr(existing.Key, ErrConflictingDeclaration)
	}

	if next.Identity != "" {
		existing.Identity = next.Identity
	}
	if next.Fingerprint != "" {
		existing.Fingerprint = next.Fingerprint
	}
	return existing, nil
}
