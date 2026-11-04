# converge

Reconcile a declarative source into a stateful target — correctly, in the right
order, and the same way every time.

```go
plan, err := converge.NewPlan(desired, inventory, converge.WithContainers(cfg))
if err != nil {
    return err                       // transient: hold position, retry
}
plan, err = converge.Restrict(plan, authorize(plan))   // your authorisation
res, err := apply.Run(ctx, plan, actuator, apply.Config{Workers: 10})
if res.Converged() {
    advancePosition(version)
}
```

## What is converge?

A planner for desired-state reconciliation, in the shape Argo CD and Terraform
made familiar: read what the source declares, read what the target holds, emit
an ordered plan, apply it. Unlike those, it knows nothing about Kubernetes,
HCL, or any provider — the source could be a Git repository, an object store, a
configuration bundle or another API, and the target an API server, a database
or a filesystem.

It has **no third-party dependencies** and performs **no I/O**. The caller
reads both sides into value types; converge does the set arithmetic, identity
resolution, container materialisation, budget admission and ordering; the
caller executes.

## When should I use it?

- The source addresses things by **hierarchical key** — a path — and the target
  addresses them by **identity**. Mapping between the two, and keeping an
  identity alive across a rename, is most of the work.
- The hierarchy is **materialised, not declared**: folders exist because
  something lives inside them, not because anyone wrote them down.
- You need **full and incremental runs to agree**. A change feed narrows the
  work; it must not change the answer.
- You need to **authorise, preview or dry-run before executing**, over a plan
  that is one reviewable object rather than a sequence of side effects.

## When should I not use it?

- **Flat key/value state.** Reconciling a map is a loop; you do not need this.
- **Bidirectional sync.** There is no merge, no common ancestor, no conflict
  resolution. The source declares and the target holds.
- **Byte-level deltas.** Fingerprints are opaque and compared only for
  equality. For transferring the content itself, use rsync or librsync.
- **Concurrent multi-writer convergence.** CRDTs answer "who wins"; converge
  answers "what ordered operations make the target match the source".
- **Kubernetes-only workloads.** If your source and target are both Kubernetes
  and you want server-side apply with inventories, `fluxcd/pkg/ssa` is purpose-built.

## The contract

For a source `S` at version `V`, the set of entities the target holds is a
function of the content of `S` at `V`. Not of the previous content, not of the
key something used to occupy, not of what the target held before, and not of
which mode produced the plan.

Four rules follow, and the API is shaped so each is hard to break:

| Rule | How it is enforced |
|---|---|
| A permanent problem excludes an entity and is reported; a transient one aborts planning | `Verdict` has no transient value; a transient condition is an error, and there is no partial plan |
| No history reaches the decision | `NewPlan` takes no previous version, no previous inventory, no authoritative change list |
| Narrowing the work never changes the answer | `WithHints` says *where to look*; every decision is re-derived inside the window |
| Exclusions are re-stated, never announced once | Every plan carries the complete current exclusion set |

The last one has a corollary worth stating plainly: a key that was never an
entity stays invisible. Reporting a README as a failure is noise, and noise is
how real warnings get ignored.

## Hierarchy

Containers are the reason this library exists rather than a thirty-line loop.
They are implied by the keys beneath them, may carry an identity the source
pins, and can be re-identified, relocated with identity intact, or orphaned.
Every ordering edge in a plan exists to protect one invariant or another:

- a container exists before anything is placed in it;
- a container is emptied before it is removed;
- deeper containers are removed before shallower ones;
- children re-parent before the container they left is removed;
- capacity is freed before a binding budget consumes it.

`Plan.Stages` partitions the operations into dependency-free batches, so a
caller can parallelise within a stage without rediscovering any of that.

## Authorisation, dry-run and preview

converge does not evaluate policy, and has no identity model. What it provides
is a plan you can inspect before any of it runs, and a correct way to narrow one:

```go
plan, err := converge.NewPlan(desired, inventory, opts...)
vetoes := myAuthorizer.Check(plan)        // or a server dry-run, or a human
plan, err = converge.Restrict(plan, vetoes)
```

`Restrict` propagates each veto to everything that depended on it, so what
comes back is still coherent rather than merely smaller. Denying a container
creation denies the writes into it; denying a deletion denies the container
removal that assumed it.

Two things to get right on your side:

- **Authorise the whole plan before executing any of it.** Checking per
  operation during application makes the target's contents depend on execution
  order and leaves no point at which the intended effect existed as one object.
- **Consult `Op.ContainerProvenance`.** An identity the source asserted at the
  planned version is only as trustworthy as that version. Authorising against a
  `FromDeclaration` identity lets a source have its permission check evaluated
  against an object it does not own.

## Try it in 5 minutes

```go
plan, _ := converge.NewPlan(
    []converge.Declaration{
        {Key: "team/overview.json", Fingerprint: "h1"},
        {Key: "team/Backend & UI.json", Verdict: converge.Excluded, Reason: "unaddressable-key"},
    },
    []converge.Observation{
        {Key: "team/", Identity: "auto:team/", Container: true},
        {Key: "team/overview.json", Identity: "D1", Fingerprint: "h1"},
        {Key: "team/dashboard.json", Identity: "D2", Fingerprint: "h2"},
    },
    converge.WithContainers(converge.ContainerConfig{Implied: true}),
)
fmt.Print(plan)
```

```
plan mode=full scope=convergent ops=1 stages=1 exclusions=1 rejected=0
  stage 0:
    delete team/dashboard.json id=D2
  excluded team/Backend & UI.json reason=unaddressable-key removed=false
```

`team/overview.json` is unchanged, so nothing happens to it.
`team/dashboard.json` is held but nothing declares it, so it goes.
`team/Backend & UI.json` is declared but cannot be addressed, so it is not
written — and is named, every run, until someone fixes it.

More in the [package examples](example_test.go).

## Testing your integration

`converge/conformance` is the executable half of the contract: twelve
properties checked over generated scenarios against a reference model of a
target. Point it at your own configuration:

```go
func TestConformance(t *testing.T) {
    conformance.Check(t, conformance.Options{Containers: myContainerConfig(), Cases: 500})
}
```

The properties hold for the planner in general, but they can be broken from the
outside — by a `FallbackIdentity` that is not a pure function of the key, or a
fingerprint that is not content-equal. That is what running them against your
configuration catches.

`conformance.Model` is useful on its own: it applies a plan and fails on any
violation of an ordering invariant, so a hand-written test can assert that a
specific plan is safe without reimplementing the checks.

## Scale

Planning is linear in the number of entities, and a plan is a transient value —
it is built, inspected, applied and discarded.

Apple M3 Pro, entities spread over a three-level folder tree:

| | 1 000 | 10 000 | 100 000 |
|---|---:|---:|---:|
| Plan, steady state (¾ already converged) | 1.8 ms | 24 ms | 161 ms |
| Plan, from empty (every folder and entity created) | 1.8 ms | 21 ms | 152 ms |
| Plan, teardown (every folder and entity removed) | 1.7 ms | 19 ms | 142 ms |
| `Restrict` | 1.4 ms | 7.5 ms | 48 ms |
| `apply.Run`, 16 workers, no-op actuator | — | 2.5 ms | 21 ms |

Peak allocation while planning a hundred thousand entities is roughly 110–140 MB.
Most of it is the operation slice itself, and it is released with the plan.

What the shape depends on, in case you are tuning a consumer:

- **Ordering is linear in the number of containers.** A container removal waits
  for its *direct* children and the chain carries the rest. Waiting for every
  descendant instead is quadratic — teardown at ten thousand entities took
  965 ms that way, and would have been about a hundred seconds at a hundred
  thousand.
- **Key depth is computed once per sort, not per comparison.** Counting
  separators inside a comparator was a third of planning time at a hundred
  thousand keys.
- **Stages are windows into `Ops`, not copies.** They share one backing array,
  with capacity clamped so appending to a stage cannot reach into the next.
- **`Plan.Op(ref)` is a linear scan.** It is for tests and one-off lookups;
  range over `Ops` or `Stages` instead of calling it in a loop.

`TestScalesToOneHundredThousand` asserts correctness at the target size. It
sets no wall-clock bound — that would be flaky on shared CI — but it fails by
timeout if an accidental quadratic comes back.

## Documentation

- [Design specification](docs/specification.md) — the normative contract,
  algorithm and conformance obligations.
- [Adopting converge](docs/adopting.md) — how to map an existing reconciler onto it.
- `go doc github.com/grafana/grafana/pkg/converge` — the API.

## Status

New. The API is not yet stable. It lives inside the Grafana monorepo as a
submodule with no third-party dependencies, so it can move to its own
repository without a dependency migration if a second consumer appears.
