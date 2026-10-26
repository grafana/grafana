# Specification: a convergent reconciliation planner

**Status:** draft for review

**Module:** `github.com/grafana/converge`

| Package | Purity | Imports |
|---|---|---|
| `converge` | pure — no I/O, no clock, no goroutines | `errors`, `fmt`, `sort`, `strings` |
| `converge/apply` | effectful — executes a plan (§12) | the above plus `context`, `sync`, `time` |

The split is structural, not stylistic. The planner's purity is the property every guarantee
in §8 rests on, and keeping the executor in a separate package makes it impossible to
accidentally introduce a clock, a connection or a goroutine into the thing that is supposed
to be a function. Both packages are standard-library-only: the module has no third-party
dependencies, which is what makes a version bump into an old release branch a two-line
change rather than a dependency-graph migration.

Key words MUST, MUST NOT, SHOULD, SHOULD NOT, MAY are to be interpreted as in RFC 2119.

---

## 1. Purpose

A library that computes, as a **pure function**, the ordered set of operations that makes a
**target** system hold exactly the entities declared by a **source** system at a given
**version** — and that makes it structurally impossible to express a plan whose outcome
depends on history.

It is a *planner*. It performs no I/O, holds no connections, knows nothing about any
particular source (version control, object store, config bundle, another API) or any
particular target (API server, database, filesystem). The caller reads both sides into
value types; the library does set arithmetic, identity resolution, container
materialisation, budget admission and ordering; the caller executes.

**Hierarchy is the core competence, not a feature.** Flat key/value reconciliation is a
thirty-line loop that needs no library. What justifies one is that keys are hierarchical
and the containers along them are *materialised rather than declared*: they are implied by
the keys beneath them, they may carry a pinned identity supplied by a declaration at a
convention key, and they can be re-identified, relocated with identity intact, and orphaned.
Everything expensive — ordering, re-parenting, orphan cleanup, the safety invariants that
stop a container being removed out from under its contents — follows from that, and it is
exactly what every general-purpose engine surveyed (§ research notes) leaves to the caller.
§6.4 and §6.6 are therefore the normative heart of this document.

## 2. Non-goals

- **Applying the plan.** No actuator, no clients, no retries, no concurrency primitives.
- **Reading either side.** No fetching, parsing, validation or schema awareness.
- **Deciding what is valid.** The caller classifies; the library enforces the *shape* of
  that decision (§4.3, §9).
- **Deciding whether an operation is permitted.** No policy evaluation, no identity model,
  no permission checks. The library provides the primitives that let a plan be inspected
  and safely narrowed before execution (§11); it never evaluates a rule.
- **Conflict resolution / bidirectional sync.** One direction only: source declares,
  target holds. There is no merge, no ancestor, no "who wins".
- **Transport efficiency.** No byte-level deltas. Fingerprints are opaque and compared
  only for equality.
- **Status or health tracking** of applied entities.

## 3. The contract (normative)

> **C1 — State is a function of content.**
> For a source `S` at version `V`, the set of entities the target holds is a function of
> the content of `S` at `V`. It MUST NOT depend on the previous content of `S`, on the key
> an entity previously occupied, on what the target held before, or on which planning mode
> produced the plan.

Four rules derive from C1. They are the library's reason to exist, and §8 makes each one
machine-checkable.

> **C2 — Permanent exclusions are part of the desired state.**
> A condition that permanently prevents a declared entity from being held at version `V`
> excludes that entity from the desired state. The plan MUST remove it if present, MUST NOT
> write it, and MUST report it. A condition that is transient MUST NOT produce a plan at
> all — planning fails, the caller holds its position and retries.

> **C3 — No history inputs.**
> If deciding an entity's fate requires the previous key, the previous target state, or a
> change list, the rule is wrong. `Plan` therefore takes no previous version and no
> previous inventory; there is no parameter through which history could arrive.

> **C4 — Mode equivalence.**
> Narrowing the work with change hints is an optimisation, never a semantic. A hinted plan
> and a full plan over the same `(desired, inventory)` MUST converge on the same target
> state.

> **C5 — Exclusions are re-stated, not announced.**
> The plan carries the *complete* current exclusion set on every run, not the ones
> discovered since last time. Entities that were never entities stay invisible and MUST NOT
> be reported.

**Rules of thumb, carried over from the source contract:** needing to know what used to be
true is the smell. Absent-and-loud beats present-and-silent. The decision belongs to the
plan — applying it executes the plan rather than re-deciding anything.

## 4. Domain model

### 4.1 Primitives

```go
// Key is an addressable location in the source. Hierarchical, '/'-separated.
// A key ending in '/' denotes a container. Opaque to the library except for
// segmentation, depth and ancestry.
type Key string

// Identity is the target's name for an entity. Opaque; equality only.
type Identity string

// Fingerprint summarises content. Opaque; equality only. Two declarations with
// equal fingerprints are assumed to carry identical content.
type Fingerprint string

// Reason is a stable, machine-readable code explaining an exclusion or a
// non-obvious operation. Callers define the vocabulary.
type Reason string
```

The library never interprets `Fingerprint`, `Identity` or `Reason`. It never derives one
from the other.

### 4.2 The two sides

```go
// Declaration is one fact the source states at a key, already read, parsed,
// validated and classified by the caller.
type Declaration struct {
    Key         Key
    Fingerprint Fingerprint
    Verdict     Verdict
    Reason      Reason    // REQUIRED when Verdict == Excluded, else empty

    // Container marks a declaration that describes a container rather than an
    // entity (see §6.4).
    Container bool

    // Identity, when non-empty, is an identity the source itself asserts for
    // this declaration. Containers use it to pin a stable identity; entities
    // normally leave it empty and let the target assign one.
    Identity Identity
}

// Observation is one row of what the target is observed to hold.
type Observation struct {
    Key         Key
    Identity    Identity
    Fingerprint Fingerprint
    Container   bool
}
```

Both sides arrive as fully-resolved values. This is what keeps `Plan` pure, and it is what
makes the whole thing property-testable: a test constructs both sides directly, with no
fakes and no mocks.

### 4.3 Verdict — the tri-state

```go
type Verdict uint8

const (
    // Entity: declared and holdable. Belongs in the desired state.
    Entity Verdict = iota

    // Excluded: recognisably an entity declaration, permanently unholdable at
    // this version. Absent from the desired state; removed if present;
    // reported every run.
    Excluded

    // Ignored: not an entity declaration at all. Invisible. Never planned,
    // never reported, never counted.
    Ignored
)
```

The distinction between `Excluded` and `Ignored` is the whole of C5. An unreadable or
unaddressable *entity* is an `Excluded` — the user asked for something and did not get it,
so they must be told. A file that was never an entity is `Ignored` — reporting it is noise.

There is deliberately **no transient verdict**. A transient condition is an error from the
caller's classifier and aborts planning (§5.2, C2).

### 4.4 Operations

```go
type OpKind uint8

const (
    OpCreate          OpKind = iota // entity absent from target, present in desired
    OpUpdate                        // present on both sides, fingerprints differ
    OpDelete                        // present in target, absent from desired
    OpMove                          // identity-preserving re-key (§6.3)
    OpEnsureContainer               // container must exist at Key with Identity
    OpRemoveContainer               // container must not exist at Key
)

type Op struct {
    Kind        OpKind
    Key         Key         // destination key
    From        Key         // OpMove only: the source key
    Identity    Identity    // known for Update, Delete, Move, container ops
    Fingerprint Fingerprint // desired content, for Create/Update/Move
    Reason      Reason      // why, when the operation is not self-evident

    // IdentityProvenance records where Identity came from. For a container
    // operation this is the provenance of the container's own identity.
    IdentityProvenance Provenance

    // Container is the key of the container this operation resolves into, and
    // ContainerIdentity the identity that container will have. For a container
    // operation this is the container ABOVE it, never itself: conflating the
    // two tells a veto pass to authorise a container's creation against the
    // container being created. Provenance records where that identity came
    // from, which callers performing veto passes MUST consult (§11.6).
    Container           Key
    ContainerIdentity   Identity
    ContainerProvenance Provenance

    // Group, when non-empty, marks this operation as part of an all-or-nothing
    // set (§11.3). Operations sharing a Group MUST be executed together or not
    // at all.
    Group GroupID

    // DependsOn lists the operations that MUST complete before this one. It is
    // the §6.6 edge set made explicit, and it is what lets both Restrict
    // (§11.3) and the execution helper (§12) compute a dependent closure
    // without re-deriving the graph.
    DependsOn []OpRef
}

// Provenance records where an identity in a plan came from. Declared identities
// originate from the source at the planned version and are therefore only as
// trustworthy as that version.
type Provenance uint8

const (
    FromInventory   Provenance = iota // observed in the target
    FromDeclaration                   // asserted by the source at this version
    FromFallback                      // derived from the key by ContainerConfig
)

type GroupID string

// Ref names an operation stably within a plan. Derived from Kind, From and Key;
// independent of slice position so it survives re-planning.
func (o Op) Ref() OpRef

type OpRef string
```

`OpMove` is an **optimisation of `OpDelete`+`OpCreate` that preserves identity**. It MUST
be state-equivalent: a planner that never emits `OpMove` and a planner that emits it
aggressively MUST produce the same target content, differing only in which identities
survive. §8/P5 checks this.

### 4.5 Plan

```go
type Plan struct {
    // Ops in a dependency-safe total order. Executing them in order never
    // violates an invariant in §6.6.
    Ops []Op

    // Stages partition Ops into dependency-free batches. Every op in stage i
    // may run concurrently; stage i+1 MUST NOT start until stage i completes.
    // Concatenating the stages in order yields Ops.
    Stages [][]Op

    // Exclusions is the COMPLETE current exclusion set (C5), independent of
    // mode, sorted by Key.
    Exclusions []Exclusion

    // Rejected lists entities excluded by budget admission (§6.5), sorted by Key.
    Rejected []Exclusion

    Mode Mode
}

type Exclusion struct {
    Key    Key
    Reason Reason
    // Removed reports whether the plan deletes an entity that the target
    // currently holds at this key — i.e. whether this exclusion is destructive
    // on this run.
    Removed bool
}
```

## 5. API

### 5.1 Entry point

```go
func Plan(desired []Declaration, inventory []Observation, opts ...Option) (*Plan, error)
```

`Plan` MUST be pure: no I/O, no clock, no randomness, no global state, no logging. Given
equal inputs it MUST return a byte-identical plan. Input slice order MUST NOT affect the
result; the library sorts internally.

Note what the signature does **not** contain: a previous version, a previous inventory, or
a change list carrying authority. That is C3 enforced by the type system rather than by
discipline.

### 5.2 Errors

```go
var (
    ErrIncompleteInput   = errors.New("converge: input incomplete")   // hint closure unsatisfiable
    ErrAmbiguousIdentity = errors.New("converge: ambiguous identity")
    ErrDepthExceeded     = errors.New("converge: container depth exceeded")
    ErrInvalidDeclaration = errors.New("converge: invalid declaration")
)
```

Planning is **all-or-nothing**: `Plan` returns a complete plan or an error, never a partial
plan. A caller that receives an error MUST NOT advance its sync position.

### 5.3 Options

```go
// WithHints narrows planning to a set of keys (§7.2). Absent → full mode.
func WithHints(h HintSet) Option

// WithMoveDetection enables identity-preserving re-keying (§6.3). Default: on.
func WithMoveDetection(enabled bool) Option

// WithContainers configures container materialisation (§6.4). Absent → containers
// are never implied; only explicitly declared containers are planned.
func WithContainers(c ContainerConfig) Option

// WithBudget caps the number of entities admitted (§6.5).
func WithBudget(b Budget) Option

// WithExclusionScope selects whether the plan claims to converge the whole
// source or to mutate a named subset (§11.7). Default: ScopeConvergent.
func WithExclusionScope(s ExclusionScope) Option
```

Every default MUST satisfy the contract in §3. Any option that weakens it MUST be
explicitly named for what it gives up — as `ScopeTargeted` is in §11.7.

## 6. Planning algorithm (normative)

### 6.1 Desired set

Partition `desired` by verdict. `Ignored` declarations are discarded and MUST NOT appear in
any output. `Excluded` declarations contribute an `Exclusion` and are treated as **absent**
for all set arithmetic. `Entity` declarations form the desired set.

Duplicate keys in `desired` MUST yield `ErrInvalidDeclaration`: a source cannot declare two
things at one address.

### 6.2 Set arithmetic

Index `inventory` by key. For each desired entity at key `k`:

- absent from inventory → `OpCreate`
- present, fingerprints equal → no operation
- present, fingerprints differ → `OpUpdate` carrying the observed identity

For each observed entity whose key is not in the desired set → `OpDelete`.

**Duplicate observations.** A target MAY hold more than one entity at a key (a condition
the target should prevent but may not). When it does, the planner MUST pick one survivor
deterministically — the observation whose fingerprint matches the declaration, else the
lowest identity in lexicographic order — and emit `OpDelete` for the rest, with a reason
marking them as duplicates. Survivor selection MUST NOT depend on input order.

### 6.3 Move detection

When enabled, before emitting operations: pair each `OpCreate` whose fingerprint equals the
fingerprint of exactly one `OpDelete` into a single `OpMove{From: deletedKey, Key: createdKey}`
carrying the deleted entity's identity.

- A fingerprint shared by **more than one** deletion is ambiguous and MUST NOT be paired.
  The plan degrades to delete+create. It MUST NOT error.
- Deletions emitted for duplicate observations (§6.2) MUST NOT be paired.
- Container keys MUST NOT participate; containers move via §6.4.
- Pairing MUST be deterministic under input permutation.

Move detection reads only `(desired, inventory)`. It is not history. A source that reports
"A was renamed to B" supplies at most a *hint* (§7.2); the planner MUST re-derive the
pairing from fingerprints and MUST NOT take the claim as authority.

### 6.4 Containers

A container is a key that holds other keys. Containers may be **implied** by entity keys
rather than declared: entity `a/b/c.json` implies containers `a/` and `a/b/`.

```go
type ContainerConfig struct {
    // Implied enables deriving containers from entity key ancestry.
    Implied bool

    // MaxDepth caps container nesting. 0 = unlimited.
    MaxDepth int

    // DeclaringKey maps a container key to the key whose declaration, if
    // present, pins that container's identity. Returns ok=false if the scheme
    // has no such convention.
    DeclaringKey func(container Key) (Key, bool)

    // FallbackIdentity derives an identity for a container with no declaration.
    // MUST be a pure function of the key.
    FallbackIdentity func(container Key) Identity
}
```

Container planning:

1. **Desired container set** = every ancestor of every desired entity key (when `Implied`),
   plus every `Container` declaration. Depth beyond `MaxDepth` → `ErrDepthExceeded`.
2. **Desired identity** for container `c` = the `Identity` on its declaring declaration if
   one exists, else `FallbackIdentity(c)`.
3. Compare against observed containers by key:
   - absent → `OpEnsureContainer`
   - present, identity equal → no operation
   - present, identity differs → **re-identification**: `OpEnsureContainer` for the new
     identity, every entity and container directly beneath `c` becomes an `OpUpdate` or
     `OpEnsureContainer` so it re-parents, and the old container becomes a *deferred*
     `OpRemoveContainer` (§6.6).
   - observed but not desired → `OpRemoveContainer`
4. **Identity-preserving container moves.** If a desired container at `c₂` has the same
   identity as an observed container at `c₁ ≠ c₂`, and no other desired container claims
   that identity, emit a single `OpMove` for the container instead of
   ensure-new + remove-old. During execution that identity legitimately resolves to both
   keys until the deferred removal runs; the plan MUST record this so the actuator can
   tolerate it, and the exemption MUST be scoped to that exact key and its relocating
   ancestors — never to arbitrary descendants that happen to reuse the identity.

An entity whose container is `Excluded` is itself unreachable: the planner MUST mark it
`Excluded` with the container's reason rather than emitting a create whose parent cannot
exist.

### 6.5 Budgets

```go
type Budget struct {
    MaxEntities int // 0 = unlimited
}
```

A budget is a **target-side** constraint, so admitting under one is the single place where
the desired state is not a function of source content alone. The library accepts this but
contains it:

- Budget admission MUST be a function of `(desired, inventory, budget)` only.
- When the budget binds, the admitted subset MUST be chosen by a **total order over keys**
  (lexicographic, shallowest-first), never by arrival order, scheduling, or concurrency.
- Non-admitted entities become entries in `Plan.Rejected` with a budget reason. They are
  reported exactly like exclusions and MUST be re-stated every run.
- Deletions and moves MUST NOT consume budget. A plan that frees capacity before using it
  MUST order the freeing operations first (§6.6).

> This rule exists because the common implementation mistake is to reserve budget inside a
> parallel apply loop, which makes *which* entities get dropped depend on goroutine
> scheduling — two runs over identical inputs produce different target states, violating C1.

### 6.6 Ordering

The planner builds a dependency graph over operations and emits a topological order. Edges
(each is an invariant a conforming plan MUST satisfy):

| Edge | Meaning |
|---|---|
| `OpEnsureContainer(c)` → `OpCreate(k)`, `OpMove(→k)` for `k` under `c` | a container exists before anything is placed in it |
| `OpDelete(k)`, `OpMove(k→)` for all `k` under `c` → `OpRemoveContainer(c)` | a container is emptied before removal |
| `OpRemoveContainer(c')` for `c'` under `c` → `OpRemoveContainer(c)` | deepest containers first |
| `OpEnsureContainer(c_new)` → `OpUpdate(k)` for direct children of a re-identified `c` → `OpRemoveContainer(c_old)` | children re-parent before the old container goes |
| `OpDelete(*)` → `OpCreate(*)` when a budget binds | capacity is freed before it is consumed |

Cycles MUST be impossible by construction; if one is detected the library MUST panic rather
than emit an unsafe plan, since a cycle is a library bug, not an input error.

Within a stage, operations are sorted by `(depth, key)` so output is stable.

## 7. Modes

```go
type Mode uint8

const (
    ModeFull   Mode = iota // desired and inventory describe every key
    ModeHinted             // planning narrowed to a hint closure
)
```

### 7.1 Full

`desired` and `inventory` describe the complete state of both sides. This is the reference
semantics: every other mode is defined by equivalence to it.

### 7.2 Hinted

```go
type HintSet struct {
    // Keys that may have changed. Claims about *what* changed are not accepted:
    // a hint narrows which keys are re-evaluated and carries no authority over
    // the outcome.
    Keys []Key

    // Complete reports whether the hint source can guarantee that no key
    // outside Keys changed. When false, Plan MUST ignore the hints and plan in
    // ModeFull.
    Complete bool
}
```

A hint set says **where to look**, never **what to conclude**. The caller supplies
`desired` and `inventory` restricted to the hint closure; the planner applies the identical
algorithm of §6 to that restriction.

**Hint closure (normative).** Before planning, the planner expands `Keys` to its closure:

1. Every ancestor container of every hinted key.
2. If a container's declaring key is hinted, every key *directly* beneath that container —
   because re-identification re-parents direct children (§6.4.3).
3. If a hinted key is a container, every key directly beneath it.
4. When move detection is on, every key whose observed or declared fingerprint equals that
   of a hinted key — otherwise a move's other half falls outside the window and degrades
   into an unpaired delete+create. If the caller cannot supply fingerprint-matched keys,
   it MUST disable move detection for that run rather than accept a silent downgrade.

If the supplied `desired`/`inventory` do not cover the closure, `Plan` MUST return
`ErrIncompleteInput`. Planning MUST NOT silently proceed on a partial window.

**Fallback.** `Complete == false`, an unknown previous version, or a gap in versions MUST
force `ModeFull`. Soundness is never traded for a narrower scan.

**Exclusions under hints.** Exclusion enumeration requires classifying every declaration,
but classification is cheap relative to reading payloads. The default `ScopeConvergent`
therefore requires the caller to supply the full declaration list (verdicts only, no
payloads) even in hinted mode, while *materialisation* stays narrowed. A plan that makes no
convergence claim at all uses `ScopeTargeted` instead — see §11.7.

## 8. Guarantees and conformance suite

The library MUST ship these as an exported, generator-driven property suite. They are the
specification's teeth — each maps to a contract clause.

| # | Property | Statement | Clause |
|---|---|---|---|
| P1 | Determinism | Equal inputs (as multisets) produce byte-identical plans. | C1 |
| P2 | Permutation invariance | Shuffling `desired` or `inventory` does not change the plan. | C1 |
| P3 | Idempotence | `apply(Plan(D, I))` = `I′` and `Plan(D, I′).Ops` is empty. | C1 |
| P4 | Mode equivalence | For any `D, I` and any `H ⊇ diff(D, I)`: `apply(Plan(D, I, Hints(H)))` = `apply(Plan(D, I))`. | C4 |
| P5 | Move neutrality | `apply(Plan(…, MoveDetection(true)))` = `apply(Plan(…, MoveDetection(false)))`, modulo surviving identities. | §6.3 |
| P6 | Order safety | For every prefix of `Ops`, no invariant in §6.6 is violated. | §6.6 |
| P7 | Convergence | `apply(Plan(D, I))` equals the desired entity set exactly — no extra, none missing. | C1 |
| P8 | Exclusion completeness | Every `Excluded` declaration yields exactly one `Exclusion`; every `Ignored` yields none; the set is identical across runs with identical input. | C5 |
| P9 | Budget determinism | Under a binding budget, the admitted set is a function of the total key order alone. | §6.5 |
| P10 | History independence | No plan differs when the same `(D, I)` is reached by different paths. Checked by constructing `I` two ways and comparing plans. | C3 |

The reference model used by the suite is a map from `Key` to `(Identity, Fingerprint)` plus
a container set; `apply` is ~40 lines. Any consumer embedding the library SHOULD run the
suite against its own `ContainerConfig` and key scheme.

## 9. Obligations on the caller

The library can only guarantee §8 if the caller honours these. They SHOULD be stated in the
consumer's own tests.

1. **Classification is pure w.r.t. content at `V`.** `Verdict` MUST be derivable from the
   declaration's content and key alone. If deciding needs the previous key, the previous
   target state, or a change list, the rule violates C3 and MUST be redesigned.
2. **Classification is total and permanent.** Every declaration gets a verdict. Transient
   conditions are errors, not verdicts, and abort the run before `Plan` is called.
3. **Fingerprints are content-equal, not representation-equal.** Two declarations with equal
   fingerprints MUST have identical content, or move detection and update suppression are
   both wrong.
4. **`FallbackIdentity` and `DeclaringKey` are pure functions of the key.**
5. **Position advances only on full application.** A plan that was not fully applied MUST
   NOT advance the caller's version position. Exclusions and budget rejections do *not*
   block advancement — they are part of the converged state. Transient failures do.
6. **The actuator re-decides nothing.** It executes `Ops` in order. Any branch in the
   actuator that could change *what* ends up in the target is a contract violation; the
   decision belongs to the plan.

## 10. Worked example

Source declares `a/one.json` (fp `h1`) and `a/Bad & Name.json` (fp `h2`, classified
`Excluded`, reason `unaddressable-key`). Target holds `a/one.json` → `E1`/`h1` and
`a/two.json` → `E2`/`h2`.

```
desired:   {a/one.json h1 Entity}  {a/Bad & Name.json h2 Excluded unaddressable-key}
inventory: {a/one.json E1 h1}      {a/two.json E2 h2}
           + container a/ → C1
```

Plan (full mode):

```
Stages: [[ OpDelete{Key: a/two.json, Identity: E2} ]]
Exclusions: [{Key: a/Bad & Name.json, Reason: unaddressable-key, Removed: false}]
```

`a/one.json` is unchanged, so no operation. `a/two.json` has no declaration — the excluded
one does not count as a declaration — so it is deleted. The exclusion is reported, and will
be reported again on every subsequent run until the key is fixed. `Removed: false` because
nothing was held at the excluded key itself.

Hinted mode with `Keys: [a/two.json, a/Bad & Name.json]` and `Complete: true` expands the
closure to include `a/` and, with move detection on, every key whose fingerprint is `h2`.
It produces the identical plan — which is P4.

Had move detection been enabled with a narrower window that excluded `h2`'s other half, the
planner would return `ErrIncompleteInput` rather than silently emit an unpaired delete.

Note the convergence this buys: a target that previously kept `E2` alive on the grounds
that "its file was only renamed" would hold an entity nothing declares, reachable by no
source edit, invisible to the next plan. The contract removes it and says why.

## 11. Veto passes: authorization, dry-run and other target-side admission

### 11.1 Rationale

Because a plan is a value and not a sequence of side effects, it can be inspected before any
of it executes. That is what makes "plan, then authorize, then apply" possible without the
library knowing anything about authorization.

Authorization and server dry-run are **target-side admission**, structurally identical to
budget (§6.5): a constraint that is not a function of source content, that must be applied
deterministically, and whose effect must be reported rather than silently absorbed. The
library therefore gains one concept — a **veto** — and authorization becomes one caller of
it. The library knows about vetoes; it never learns why.

Two things get conflated under "dry run" and must be separated:

- **Plan preview** — showing a user what would happen. Free: the plan is already a
  serializable value with a canonical ordering. No new mechanism.
- **Server dry-run** — asking the target whether an operation would succeed. I/O, therefore
  the caller's job, and its results arrive back as vetoes.

### 11.2 API

```go
type Veto struct {
    Ref    OpRef
    Reason Reason
}

// Restrict removes vetoed operations and their dependents, returning a plan that
// still satisfies every invariant in §6.6. Pure.
func Restrict(p *Plan, vetoes []Veto) (*Plan, error)
```

The caller sits between `Plan` and `Restrict` and does whatever I/O it likes — permission
checks, dry-run round trips, policy evaluation, human approval. Neither function performs
any.

### 11.3 Closure rules (normative)

Dropping operations from a plan naively produces an incoherent one: remove a container
create but keep the writes into it, or keep a container removal whose contents were not
emptied, and the plan becomes unsafe. `Restrict` MUST therefore propagate vetoes along the
dependency graph of §6.6, in both directions, each for a different reason:

| Direction | Rule |
|---|---|
| **Downward** (an enabler is vetoed) | Vetoing `OpEnsureContainer(c)` MUST veto every `OpCreate` and `OpMove` resolving into `c`, and every `OpEnsureContainer` for a descendant of `c`. Nothing can be placed in a container that will not exist. |
| **Upward** (an emptying is vetoed) | Vetoing `OpDelete(k)` or `OpMove(k→)` for `k` under `c` MUST veto `OpRemoveContainer(c)`. A container that was not emptied MUST NOT be removed. |
| **Neither** | Vetoing `OpUpdate` does not cascade. Vetoing `OpRemoveContainer` does not cascade: leaving a container in place is safe. |

Additional rules:

- **Atomic groups.** Operations sharing a non-empty `Group` are all-or-nothing: vetoing any
  member MUST veto all of them. Container re-identification (§6.4.3) MUST form one group —
  ensure-new, the direct-child re-parents, and the deferred remove-old — because a partially
  applied re-identification leaves children pointing at a container that is about to
  disappear.
- **No downgrade.** A vetoed `OpMove` is dropped. It MUST NOT be rewritten as
  `OpDelete`+`OpCreate`: a caller that denied the move did not authorise a delete.
- **Stages are recomputed.** `Restrict` MUST rebuild `Stages` from the surviving operations;
  it MUST NOT return stages with holes.
- **Vetoed operations are reported.** Each becomes an `Exclusion` carrying the veto's reason,
  so a denied write lands in the same user-facing list as an unaddressable key. The
  "absent plus loud" rule applies to permissions exactly as it applies to bad paths.

### 11.4 Conformance additions

| # | Property | Statement |
|---|---|---|
| P11 | Restriction safety | `Restrict` output satisfies P6, and contains no operation whose enabling dependency was vetoed. |
| P12 | Restriction idempotence | `Restrict(Restrict(p, v), v)` equals `Restrict(p, v)`. |
| P13 | Veto monotonicity | For `v ⊆ v′`, `Restrict(p, v′)` has no operation absent from `Restrict(p, v)`. |
| P14 | No downgrade | No operation appears in `Restrict(p, v)` that is absent from `p`. |
| P15 | Veto order independence | Permuting `vetoes` does not change the result. |

### 11.5 Caller obligations

1. **Veto decisions MUST be deterministic** given the operation and the external state they
   consult, and MUST NOT depend on the operation's position in the plan.
2. **Veto the whole plan before executing any of it.** Checking permissions or dry-running
   operation-by-operation *during* apply reintroduces exactly the defect §6.5 describes for
   budgets: what ends up in the target depends on execution order. It also makes the run
   unauditable, because there is no point at which the intended effect existed as one
   reviewable object.
3. **Vetoes MUST NOT be persisted as skip reasons.** Every run re-evaluates from scratch. If
   a permission is granted later, the next plan MUST converge without operator action.
   Caching "this was denied" recreates the state-never-heals failure that the contract in
   §3 exists to eliminate.
4. **Permanent and transient are still distinct.** A dry-run that fails validation is
   permanent and becomes a veto. A dry-run that fails on a timeout, a 5xx or contention is
   transient: planning aborts, nothing is vetoed, the position does not advance. Converting
   a transient failure into a veto misreports it to the user as "not permitted" and, for a
   vetoed deletion, silently preserves an entity nothing declares.
5. **A vetoed plan does not converge**, and the caller MUST surface that rather than report
   success. This is the same crack in C1 as budget admission; it is contained by determinism,
   by re-statement every run, and by visibility — not closed.

### 11.6 Security: identity provenance

This is the one place where "the library is not about authorization" could still cause a
security defect — by handing the caller a convenient-looking identity with no indication of
where it came from.

A plan built from an untrusted version carries container identities *asserted by that
version* (`FromDeclaration`). A caller that authorises against such an identity can be made
to run its permission check against the wrong target object: a source that asserts a
container identity it does not own gets its check evaluated against whatever the victim
object is, not against where the write will land.

Therefore:

- Every operation MUST carry `Container`, `ContainerIdentity` and `ContainerProvenance`
  (§4.4), describing the container the operation resolves *into* — for a container
  operation, the one above it. The operation's own identity and its provenance are
  `Identity` and `IdentityProvenance`.
- A caller performing a veto pass MUST NOT authorise against a `FromDeclaration` or
  `FromFallback` identity without independently resolving the effective target location from
  trusted state.
- The library supplies the provenance. It MUST NOT make, or appear to make, the decision.

Note the consequence for plan preview: a plan is safe to *show* regardless of provenance, but
not safe to *authorise* against. Those are different operations on the same value.

### 11.7 Targeted plans: the single-mutation case

A plan is not only a bulk-convergence artefact. **A single write is a plan of size one or
two**, and expressing it as one is how a consumer gets the same authorization path for an
interactive API as for a background convergence run.

A request to write content at key `K` is `Plan` in hinted mode with `Keys: [K]`,
`Complete: true`, and `ExclusionScope: ScopeTargeted`. The hint closure (§7.2) expands to
`K`'s ancestor containers, so the resulting plan contains exactly the container ensures the
write implies plus the create or update itself — which is precisely the set an authorization
pass must evaluate, because inherited container permissions are what govern the write.

```go
type ExclusionScope uint8

const (
    // ScopeConvergent: the plan claims to converge the whole source. The
    // complete exclusion set is required (C5). Bulk reconciliation uses this.
    ScopeConvergent ExclusionScope = iota

    // ScopeTargeted: the plan mutates a named subset and makes no claim about
    // the rest of the source. Exclusions are reported only for keys inside the
    // hint closure. Interactive single-key APIs use this.
    ScopeTargeted
)
```

`ScopeTargeted` is not a weakened `ScopeConvergent` — it is a different claim. A targeted
plan never asserted that it had surveyed the source, so reporting only the exclusions it
touched is honest rather than lossy. A consumer MUST NOT use `ScopeTargeted` for a run whose
purpose is convergence; doing so silently drops C5.

Two obligations follow, and they are the reason this case belongs in the library rather than
beside it:

1. **One classifier serves every path.** The function that decides `Verdict` MUST be shared
   between the convergence path and every interactive write path. A key that convergence
   would classify `Excluded` MUST be refused by the write path, with the same `Reason`. Two
   implementations of the same rule is the defect this unification exists to remove: it
   produces an API that accepts a write which the next convergence run deletes.
2. **Provenance governs the check on both paths.** A delete or update routed through an
   interactive API MUST be authorised against the container identity the target actually
   holds (`FromInventory`), not the one the request asserts. This is the same rule as
   §11.6, and it is what stops a request from relocating a resource by declaring a
   different parent.

## 12. Applying a plan — `converge/apply`

Normative for the helper package. A consumer MAY execute `Plan.Ops` itself; the guarantees
below then become its own responsibility.

### 12.1 Shape

```go
package apply

// Actuator performs one operation against the target. The only interface the
// consumer must implement.
type Actuator interface {
    Execute(ctx context.Context, op converge.Op) error
}

// Dispatcher routes by kind, for consumers that prefer per-kind functions to a
// switch. Any nil field makes its kind a no-op.
type Dispatcher struct {
    Create, Update, Delete, Move           func(context.Context, converge.Op) error
    EnsureContainer, RemoveContainer       func(context.Context, converge.Op) error
}

func Run(ctx context.Context, p *converge.Plan, a Actuator, cfg Config) (*Result, error)
```

### 12.2 Configuration

```go
type Config struct {
    // Workers caps concurrent operations within a stage. 0 or 1 = serial.
    Workers int

    // Serial lists kinds that MUST run one at a time regardless of Workers.
    // Container operations commonly belong here: ensuring a container walks its
    // ancestors, so concurrent ensures race on shared parents.
    Serial []converge.OpKind

    // OpTimeout bounds a single operation. 0 = inherit ctx only. A conforming
    // implementation MUST always bound an operation, falling back to a
    // documented default when 0.
    OpTimeout time.Duration

    // ContinueOnError keeps going after a failure, skipping only the failed
    // operation's dependents. Default (false) is fail-fast: the stage drains
    // and the run stops.
    ContinueOnError bool
}
```

### 12.3 Execution semantics (normative)

1. **Stages are barriers.** Stage `i+1` MUST NOT begin until every operation in stage `i`
   has terminated. Within a stage, operations MAY run concurrently up to `Workers`, except
   those whose kind appears in `Serial`.
2. **Groups are atomic in intent, not in effect.** The helper MUST schedule a `Group`'s
   operations in one stage where the plan allows it, and MUST skip the remainder of a group
   as soon as any member fails. It cannot roll back; a group that fails part-way is reported
   as such, and the consumer MUST NOT advance its version position.
3. **Failure propagates along `DependsOn`.** When an operation fails, every operation whose
   transitive `DependsOn` closure includes it MUST be marked `Skipped` and MUST NOT be
   attempted. This is the runtime twin of §11.3's downward closure, and it is why `DependsOn`
   is part of the plan rather than derived.
4. **Cancellation.** On `ctx` cancellation the helper MUST stop scheduling, wait for
   in-flight operations to return, and mark the rest `NotAttempted`.
5. **No re-deciding.** The helper MUST NOT alter, reorder beyond the stage/serial rules,
   substitute, retry, or skip operations for any reason other than rules 3 and 4. Retry
   policy belongs to the `Actuator`. This is §9.6 enforced by the helper's own scope.
6. **Determinism of reporting.** `Result.Outcomes` MUST be in plan order regardless of
   completion order.

### 12.4 Result

```go
type Result struct {
    Outcomes []OpOutcome // plan order
    Applied, Failed, Skipped, NotAttempted int
}

type OpOutcome struct {
    Ref    converge.OpRef
    Status Status // Applied | Failed | Skipped | NotAttempted
    Err    error
}

// Converged reports whether every operation in the plan was applied. A consumer
// MUST NOT advance its version position when this is false.
func (r *Result) Converged() bool
```

### 12.5 Observation

```go
// Observer receives callbacks. No logging, no metrics, no tracing in the
// library — the consumer owns all three.
type Observer interface {
    OpStarted(converge.Op)
    OpFinished(converge.Op, Status, error)
    StageFinished(index int, r *Result)
}
```

`Config` carries an optional `Observer`. Callbacks MUST NOT be invoked concurrently for the
same operation, MAY be invoked concurrently across operations, and MUST NOT block the
scheduler for longer than the consumer intends — the helper makes no guarantee about which
goroutine calls them.

### 12.6 Recovery

There is no checkpointing and no resume. Because planning is pure and cheap relative to
application, the recovery story is **re-plan, do not resume**: a partially applied plan
leaves the target in a state the next `Plan` call reads directly and corrects. A consumer
MUST NOT persist a plan and replay it later; the inventory it was computed against may have
moved.

### 12.7 Why stages rather than a DAG scheduler

Stage barriers idle a worker that could have started an operation whose dependencies are
already satisfied. A full DAG scheduler would not. Stages are specified anyway because they
are a fraction of the complexity, and because real plans are dominated by one wide stage of
independent entity writes where the two schedules are identical. `DependsOn` is in the plan
format precisely so a DAG scheduler can be added later without changing it.

## 13. Known gaps to resolve during implementation

1. **Budget admission is currently reservation-at-apply in the reference consumer**, which
   is exactly the P9 violation described in §6.5. Moving admission into the planner is a
   behaviour change: which entities get dropped under pressure becomes deterministic, and
   therefore different from today.
2. **`ScopeTargeted` must not leak into convergence paths.** It exists for interactive
   single-key writes (§11.7), where making no claim about the rest of the source is honest.
   Used for a run whose purpose is convergence it silently drops C5. Consider enforcing the
   distinction in the type system — a separate entry point for targeted plans — rather than
   leaving it as an option a caller can set by accident.
3. **Container re-identification fan-out.** §6.4.3 re-parents *direct* children. Whether
   transitive descendants need re-parenting depends on whether the target addresses
   children by parent identity or by full key. The config needs a flag, or the spec needs
   to pick one and say so.
4. **Depth limits interact with implied containers**: an entity at a legal depth may imply a
   container at an illegal one only if `MaxDepth` counts differently from the key scheme.
   Define the counting convention precisely before coding.
5. **Authorization and dry-run are per-operation and inside the write path today** in the
   reference consumer: `ParsedResource.DryRun` is invoked from each `dualwriter` branch
   (create, update, delete, move) with a `SkipDryRun` escape hatch, and permission checks run
   per resource as it is written. Both are the §11.5.2 anti-pattern — what lands in the target
   depends on execution order, and no reviewable statement of intent exists at any point.
   Moving them to a veto pass over a whole plan is a behaviour change: a run that today
   half-applies before hitting a denial would instead apply a smaller, coherent plan.
6. **Provenance must be threaded from the state-capture layer.** The reference consumer's
   authorizer deliberately resolves container identities from the trusted version rather than
   the requested one, to defeat identity spoofing. That property is currently enforced inside
   the authorizer; under §11.6 the planner must carry provenance so the guarantee survives the
   move, and the two must not disagree about which version is trusted.
7. **Two authorization implementations must become one.** The reference consumer authorises
   the convergence path and its interactive file API separately, against the same rules. That
   is the defect §11.7 removes — divergence between them produces an API that accepts a write
   the next convergence run deletes. Migrating both onto a single veto pass over a plan is the
   point of the exercise, but it is a behaviour change on the interactive path: a write that
   today succeeds while its implied container ensure would have been denied becomes a denial
   of the whole targeted plan. Enumerate those cases before switching.

---

## Appendix A — mapping to the Git Sync case (non-normative)

| Spec term | Git Sync |
|---|---|
| Source / Version | repository / commit ref |
| Target | Grafana API server |
| Key | repository-relative file path |
| Identity | Kubernetes resource name |
| Fingerprint | blob hash / `sourceChecksum` |
| Entity | dashboard, library panel, playlist… |
| Container | folder |
| Container declaring key | `_folder.json` |
| `Excluded` | unaddressable path, oversized file, invalid body, over-limit identity |
| `Ignored` | README, image, `.keep`, hidden file |
| Hints, `Complete=true` | commit diff between two refs |
| `Complete=false` | unknown previous ref, force-push, gap |
| Budget | repository resource quota |

Appendix A is illustrative. Nothing in §§3–9 may reference it.

---

## Appendix B — what implementing it changed (non-normative)

Four things the spec got wrong or left unsaid, found by writing the code and
the examples.

**1. `Plan` is a type, so the entry point is `NewPlan`.** A package cannot
export both. Godoc groups the constructor under the type, which is the right
organisation anyway.

**2. `ScopeTargeted` restricts operations, not just reporting.** The spec
treated the scope as a claim about *which exclusions are listed*. Writing the
single-write example showed that is not enough: a targeted plan pulls its
ancestor containers into the hint closure, and the planner then re-identified
the container the write landed in — a side effect nobody asked for. A plan
handed a subset of the source has no standing to decide a container's identity
is wrong or that anything else in the closure should go. `ScopeTargeted` now
means: act on the keys the caller named, plus the container ensures that make
those acts possible; everything else in the closure is read-only context, still
needed to pair a relocation and resolve a container, but never acted on.

**3. An `Ignored` key that the target still holds is deleted, silently.** The
spec said ignored keys stay invisible and stopped there. Invisible means
unreported, not untouched: a key the source says is not an entity declares no
entity, so one the target holds there is removed. Whether a given key is "not
an entity" or "an entity that cannot be held" is the classifier's call, and it
is exactly the difference between a silent removal and a reported one — which
makes drawing that line the single most consequential thing a consumer does.
Renaming `dash.json` to `dash.txt` removes the dashboard with no warning if
`.txt` is ignored, and with a warning if it is excluded.

**4. Hint coverage is not checkable from inside the planner.** `ErrIncompleteInput`
was specified as firing when the inputs do not cover the hint closure. They
always do, by construction: the closure is computed *from* the supplied inputs,
so a declaration the caller omitted is indistinguishable from one the source
does not make. The only checkable case is an empty hint set with `Complete:
true`, which would yield an empty plan indistinguishable from convergence and
is refused. Coverage is therefore a caller obligation, discharged by the
conformance suite, which derives the complete difference set in
`hintKeysFor` — including the fingerprint closure that keeps both halves of a
relocation inside the window. That function is the clearest statement of what
a change-feed adapter has to produce.
