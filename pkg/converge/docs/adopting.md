# Adopting converge in an existing reconciler

This is a worked migration against the reconciler converge was extracted from:
Grafana's provisioning (Git Sync) packages. It serves as a template, and as an
honest account of what adoption costs.

## What the existing code does

Two consumers reconcile the same source into the same target, independently.

**The convergence path** (`pkg/registry/apis/provisioning/jobs/sync`, 3 689 LOC
production / 11 762 LOC tests) reads a repository tree, lists what the target
holds, diffs, and applies — with a full variant and an incremental variant that
take the change list from the version control system.

**The interactive path** (`pkg/registry/apis/provisioning/files.go` plus
`resources/dualwriter.go`, 1 315 LOC) serves single-file reads and writes for
the UI: create, update, move, delete, and folder metadata.

They share a target, a key scheme, a path policy and a permission model. They
do not share an implementation of any of them.

## What moves

Classifying every function in the convergence path by where it would live:

| Destination | LOC | What |
|---|---:|---|
| `converge` (planner) | 1 925 | `Changes`, `DetectRenames`, the folder-metadata diff and its incremental twin, the diff tracker, `categorizeChanges`, `collectFolderMoves`, `relocatingFoldersForPath`, `shouldSkipChange`, the rename splitting and action-priority sorting, orphan-folder detection, folder-deletion dedup |
| `converge/apply` | 388 | `applyChanges`, `applyFoldersSerially`, `applyResourcesInParallel`, `cleanupOrphanFolders`, `wrapWithTimeout` |
| stays | 1 376 | `SyncWorker`, `FullSync`/`IncrementalSync` orchestration, `applyChange` (the actuator), progress and condition reporting, quota reservation, folder-metadata reads |

**62% of the production code is planner or scheduler, and none of it is about
this domain.** Of the tests, 5 017 LOC move with the planner and 6 745 stay with
the orchestration and the actuator.

The replacement is roughly one-for-one in lines — the `converge` package is
1 880 LOC, much of it documentation. Lines are not the point. What changes is
that the logic has one home, one test suite, and one owner; that two consumers
share it instead of each having a version; and that ordering is derived from
declared edges rather than maintained by hand across six phase buckets.

## Mapping

| Existing | converge |
|---|---|
| `repository.FileTreeEntry{Path, Hash, Blob}` | `Declaration{Key, Fingerprint, Container}` |
| `provisioning.ResourceListItem{Path, Hash, Name, Group, Resource}` | `Observation{Key, Fingerprint, Identity, Container}` |
| `resources.IsPathSupported` failing | `Verdict: Excluded` with a reason |
| `README.md`, `.keep`, hidden files | `Verdict: Ignored` |
| `_folder.json` | `Declaration{Key: <dir>, Container: true, Identity: <uid>}` |
| hash-derived folder UID | `ContainerConfig.FallbackIdentity` |
| `ResourceFileChange{Action, Path, Existing}` | `Op{Kind, Key, Identity}` |
| `FileActionRenamed` + `DetectRenames` | `OpMove` + content pairing |
| `FolderRenamed` | container re-identification group |
| `categorizeChanges`'s six buckets | `Plan.Stages` |
| `repo.CompareFiles(prev, cur)` | `HintSet{Keys, Complete: true}` |
| `quotas.QuotaTracker` reservation | `Budget` admission |
| `EnsureFolderPathExist` | `OpEnsureContainer` |
| `JobProgressRecorder` | `apply.Observer` |

Note what the last two rows cost. `EnsureFolderPathExist` is currently called
from **five** places with five different option sets: `DualReadWriter.CreateFolder`,
`UpdateFolderMetadata`, `createOrUpdate`, `moveFile`, and `FolderManager.RenameFolderPath`,
plus both sync paths. Each one re-derives, at write time, the container
structure a write implies. Under converge the planner derives it once and the
actuator does as it is told.

## The convergence path

```go
func (s *Syncer) sync(ctx context.Context, repo repository.Reader, ref string, prev string) error {
    desired, err := s.declare(ctx, repo, ref)   // ReadTree + classify
    if err != nil {
        return err                               // transient: hold the position
    }
    inventory, err := s.observe(ctx)             // repositoryResources.List
    if err != nil {
        return err
    }

    opts := []converge.Option{
        converge.WithContainers(folderConfig()),
        converge.WithBudget(converge.Budget{MaxEntities: s.quota}),
    }
    // Incremental is the same planner with a narrower window. It is not a
    // second algorithm, which is what makes the two modes agree.
    if prev != "" {
        if hints, ok, err := s.hints(ctx, repo, prev, ref); err != nil {
            return err
        } else if ok {
            opts = append(opts, converge.WithHints(hints))
        }
    }

    plan, err := converge.NewPlan(desired, inventory, opts...)
    if err != nil {
        return err
    }

    s.progress.SetTotal(ctx, len(plan.Ops))
    for _, e := range append(plan.Exclusions, plan.Rejected...) {
        s.progress.Record(ctx, warningFor(e))     // re-stated every run
    }

    res, err := apply.Run(ctx, plan, s.actuator(repo, ref), apply.Config{
        Workers:   s.maxWorkers,
        Serial:    []converge.OpKind{converge.OpEnsureContainer, converge.OpRemoveContainer},
        OpTimeout: s.resourceTimeout,
        Observer:  progressObserver{s.progress},
    })
    if err != nil {
        return err
    }
    if !res.Converged() {
        return fmt.Errorf("%d operations failed", res.Failed)
    }
    return s.advance(ctx, ref)
}
```

Two details carry most of the behaviour change:

- `s.hints` returns `ok == false` for an unknown previous ref, a force-push or
  a version gap, and planning falls back to a full run. Today that decision is
  implicit in which function gets called.
- Exclusions are recorded from the plan, before application, on every run. The
  current code reports them from inside the apply loop, so an exclusion outside
  the incremental window goes unmentioned until the next full sync.

## The interactive path

A single write is a plan of one or two operations, and that is what gives both
paths the same authorisation:

```go
func (c *filesConnector) planWrite(ctx context.Context, repo repository.ReaderWriter,
    path, ref string, body []byte) (*converge.Plan, error) {

    decl, err := c.classify(ctx, path, body)     // the SAME classifier as sync
    if err != nil {
        return nil, err
    }
    inventory, err := c.observeAround(ctx, path) // the key and its ancestors
    if err != nil {
        return nil, err
    }

    return converge.NewPlan(
        []converge.Declaration{decl}, inventory,
        converge.WithContainers(folderConfig()),
        converge.WithHints(converge.HintSet{Keys: []converge.Key{converge.Key(path)}, Complete: true}),
        converge.WithExclusionScope(converge.ScopeTargeted),
    )
}
```

`ScopeTargeted` is load-bearing. A plan handed one declaration has no standing
to decide that a folder's identity is wrong or that something else in the
closure should go, so a targeted plan ensures the path it needs and touches
nothing else. Without it, writing one file would re-identify the folder it
lands in.

Authorisation then becomes one pass over a plan, shared by both consumers:

```go
func (a *authorizer) vetoes(ctx context.Context, p *converge.Plan) ([]converge.Veto, error) {
    var out []converge.Veto
    for _, op := range p.Ops {
        // An identity the source asserted is only as trustworthy as the ref it
        // came from. A branch can claim any folder UID it likes. A container
        // operation carries no identity for the container above it, and the
        // zero provenance reads as trusted, so an unresolved parent would be
        // checked at the root.
        folder := op.ContainerIdentity
        if !op.ContainerProvenance.Trusted() || (folder == "" && op.Container != "") {
            var err error
            if folder, err = a.resolveFromConfiguredBranch(ctx, op.Container); err != nil {
                return nil, err                   // transient: not a veto
            }
        }
        allowed, err := a.check(ctx, verbFor(op.Kind), folder, op.Key)
        if err != nil {
            return nil, err                       // transient: not a veto
        }
        if !allowed {
            out = append(out, converge.Veto{Ref: op.Ref(), Reason: "forbidden"})
        }
    }
    return out, nil
}
```

The provenance check is not new policy. It is the existing rule — "folder
metadata is always read from the configured branch, never a caller-supplied
ref, because branch metadata is user-controlled and can spoof folder UIDs" —
relocated from one implementation into something both consumers see.

## What this changes in behaviour

Adoption is not refactoring. These are visible differences, and each needs a
decision before it ships.

1. **Budget admission becomes deterministic.** Quota is reserved today inside
   the parallel apply loop, so which resources get dropped under pressure
   depends on goroutine scheduling. Under converge it is a function of key
   order. Two runs over identical inputs will now drop the same resources —
   but not necessarily the ones they dropped before.
2. **Authorisation moves from per-write to per-plan.** An interactive write
   that today succeeds while the folder ensure it implies would have been
   denied becomes a denial of the whole targeted plan. Enumerate those cases.
3. **Server dry-run moves out of the write path.** `ParsedResource.DryRun` is
   called from each `dualwriter` branch with a `SkipDryRun` escape. It becomes a
   veto source evaluated before anything runs — with the permanent/transient
   distinction made explicit, which it currently is not.
4. **Exclusions are re-stated every run.** Repositories that report clean today
   because an exclusion fell outside the incremental window will start
   reporting it.
5. **Ordering is derived.** The six phase buckets and the relocating-UID
   exemptions are replaced by declared edges. Any behaviour that depended on an
   accident of the current phase order changes.

## Sequencing

1. Build the classifier — the function from a tree entry to a `Verdict`. It is
   the whole of the domain knowledge and nothing else can be written until the
   `Excluded`/`Ignored` line is drawn.
2. Run `conformance.Check` against the real `ContainerConfig`. A
   `FallbackIdentity` that is not a pure function of the key fails here rather
   than in production.
3. Migrate the convergence path. Keep `applyChange` as the actuator; it is
   already the right shape.
4. Migrate the interactive path onto `ScopeTargeted`, and delete the second
   authorisation implementation.
5. Only then consider whether the module should leave the monorepo.
