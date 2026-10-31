package converge

// Verdict classifies a declaration. The distinction between [Excluded] and
// [Ignored] is what keeps reporting honest: an entity the user asked for and
// did not get must be named, and a key that was never an entity must stay
// invisible.
//
// There is deliberately no transient verdict. A transient condition — a
// timeout, a 5xx, contention — is an error from the caller's classifier and
// aborts the run before a plan exists. Encoding it as a verdict would make the
// target's contents depend on the weather.
type Verdict uint8

const (
	// Entity is declared and holdable. It belongs in the desired state.
	Entity Verdict = iota

	// Excluded is recognisably an entity declaration that is permanently
	// unholdable at this version: an unaddressable key, a body that fails
	// validation, an identity over a length limit. It is absent from the
	// desired state, removed from the target if present, and reported on
	// every run.
	Excluded

	// Ignored is not an entity declaration at all. It is never planned, never
	// reported and never counted.
	Ignored
)

func (v Verdict) String() string {
	switch v {
	case Entity:
		return "entity"
	case Excluded:
		return "excluded"
	case Ignored:
		return "ignored"
	}
	return "unknown"
}

// Identity is the target's name for an entity or container. Opaque; compared
// only for equality.
type Identity string

// Fingerprint summarises content. Opaque; compared only for equality. Two
// declarations with equal fingerprints must carry identical content, or both
// move detection and update suppression are wrong.
type Fingerprint string

// Reason is a stable, machine-readable code explaining an exclusion or a
// non-obvious operation. The vocabulary belongs to the caller; this package
// never reads one, with the exception of the reserved values below, which it
// emits itself.
type Reason string

// Reasons emitted by this package. Callers must not reuse them for other
// conditions.
const (
	// ReasonDuplicate marks the deletion of a surplus entity found at a key
	// the target should hold only one of.
	ReasonDuplicate Reason = "converge/duplicate-at-key"

	// ReasonContainerExcluded marks an entity excluded because the container
	// it would live in is itself excluded.
	ReasonContainerExcluded Reason = "converge/container-excluded"

	// ReasonReparent marks an update emitted so an entity follows its
	// container to a new identity.
	ReasonReparent Reason = "converge/reparent"

	// ReasonParentChanged marks a container re-asserted because the container
	// above it took a new identity. It is distinct from ReasonReparent: this
	// container keeps its own identity, so it is not being replaced.
	ReasonParentChanged Reason = "converge/parent-changed"

	// ReasonOverBudget marks an entity not admitted because a budget binds.
	ReasonOverBudget Reason = "converge/over-budget"

	// ReasonDuplicateIdentity marks a container excluded because an earlier
	// one in key order already claims its identity.
	ReasonDuplicateIdentity Reason = "converge/duplicate-identity"

	// ReasonContentChanged marks a container re-asserted because the content
	// the source states about it changed while its identity did not.
	ReasonContentChanged Reason = "converge/content-changed"

	// ReasonVetoed marks an operation removed by a veto pass, and
	// ReasonVetoedDependency one removed because something it depended on was.
	ReasonVetoed           Reason = "converge/vetoed"
	ReasonVetoedDependency Reason = "converge/vetoed-dependency"
)

// Provenance records where an identity in a plan came from. A caller
// performing a veto pass must consult it: an identity asserted by the source
// is only as trustworthy as the version it was read from, and authorising
// against one lets a source have a permission check evaluated against an object
// it does not own.
type Provenance uint8

const (
	// FromInventory means the identity was observed in the target.
	FromInventory Provenance = iota
	// FromDeclaration means the source asserted it at the planned version.
	FromDeclaration
	// FromFallback means it was derived from the key by [ContainerConfig].
	FromFallback
)

func (p Provenance) String() string {
	switch p {
	case FromInventory:
		return "inventory"
	case FromDeclaration:
		return "declaration"
	case FromFallback:
		return "fallback"
	}
	return "unknown"
}

// Trusted reports whether the identity was observed in the target rather than
// asserted by the source. It is a convenience for veto passes; it is not a
// security decision in itself.
func (p Provenance) Trusted() bool { return p == FromInventory }

// Declaration is one fact the source states at a key: already read, parsed,
// validated and classified by the caller. Planning performs no I/O, so every
// declaration arrives fully resolved.
type Declaration struct {
	Key         Key
	Fingerprint Fingerprint

	// Verdict classifies the declaration. Reason is required when Verdict is
	// [Excluded] and must be empty otherwise.
	Verdict Verdict
	Reason  Reason

	// Container marks a declaration that describes a container rather than an
	// entity.
	Container bool

	// Identity, when set, is an identity the source itself asserts. Containers
	// use it to pin a stable identity across relocations; entities normally
	// leave it empty and let the target assign one.
	Identity Identity
}

// Observation is one row of what the target is observed to hold.
type Observation struct {
	Key         Key
	Identity    Identity
	Fingerprint Fingerprint
	Container   bool

	// Parent is the identity of the container this entity currently sits in.
	//
	// A key alone cannot answer that question whenever a target holds more
	// than one container at a key, or is about to give a container a new
	// identity: the entity's content is unchanged and its key is unchanged,
	// but the container beneath it is not the one it should end up in. Supply
	// it and such an entity is rewritten so it follows; leave it empty and the
	// planner cannot tell, so it does not try.
	Parent Identity
}
