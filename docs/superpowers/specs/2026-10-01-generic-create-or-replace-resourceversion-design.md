# Design: generic create-or-replace via sentinel resourceVersion

**Status:** proposed (revised — supersedes this document's own first version from earlier today)
**Author:** Charandas Batra
**Date:** 2026-10-01
**Related:** a Terraform-provider overwrite escalation tracked privately; see git history for prior investigation notes. (Kept deliberately generic here — this file lives in a public repo.)

## Problem

Terraform's dashboard resources set an `overwrite` option, but `terraform apply` against a dashboard that already exists (created via the UI, never imported into Terraform state) fails with `409 AlreadyExists`. Root cause, confirmed in both repos' source: the provider's generic resource framework only reads `overwrite` on its Update lifecycle method, never on Create — and Terraform always calls Create for a resource it doesn't have in its own state, regardless of whether the object already exists server-side. A lead developer's proposal: let `Create` behave as an upsert when the client sets `metadata.resourceVersion` to a reserved sentinel value, implemented once, generically, for every app-sdk resource — not as a one-off, dashboard-specific mechanism.

## History: why this is this document's second version

The first version of this design (and four commits on this branch) implemented the sentinel mechanism entirely inside `pkg/storage/unified/apistore` — `Storage.Create` detects the sentinel, clears it, and a new `createOrReplace` method does a `Get`-then-`GuaranteedUpdate`. `GuaranteedUpdate` already independently re-authorizes as a real Update (`VerbUpdate`, via the storage server's own RPC) and already enforces provisioning-lock checks — both verified for free, no new authorization code needed for *those* properties.

A whole-branch review (independently verified in this session against the actual code) found this placement has a Critical gap: Grafana's admission plugins for app-sdk resources decide which business-validation function to run — `validateOnCreate` vs `validateOnUpdate` — based on which HTTP verb/endpoint the original request hit, *before* any REST or storage-layer code (including everything apistore does) ever runs. A sentinel-triggered Create that gets internally turned into a replace still only ever ran Create-flavored admission. Concretely, for the folder resource (chosen at the time purely to prove genericity, not because of real demand — see "Explicitly out of scope" below): `validateOnUpdate` has a move-permission escalation check (`checkMoveAccess` / `ErrAccessEscalation`) that `validateOnCreate` never runs, so a sentinel-triggered "replace" could move a folder across a permission boundary a real PUT would block. The same class of asymmetry exists on the dashboard resource itself (a folder-change permission check that only runs by comparing old vs. new folder, which Create has no old object to compare against) — so this isn't a folder-specific quirk; it's a systemic property of how Create-vs-Update admission is structured, and it affects the actual resource this whole effort exists for.

This is not fixable by relocating the sentinel-check to a different REST or storage layer — admission has already run, with the wrong operation classification, by the time any of those layers execute, regardless of which one.

## Decision: fix it at admission, where the choke point actually is

`pkg/services/apiserver/builder/admission.go`'s `builderAdmission` is the single shared `admission.ValidationInterface`/`MutationInterface` every app-sdk resource's own `Validate`/`Mutate` method is dispatched through (one instance, installed once into the generic apiserver's admission chain, keyed by GroupVersion). This is the correct, and only, choke point that runs *before* the operation-type decision has already locked in a Create-flavored code path everywhere downstream.

### Mechanics

1. **Opt-in capability.** A new interface, analogous to the existing `APIGroupMutation`/`APIGroupValidation` pattern:
   ```go
   type APIGroupGetter interface {
       Get(ctx context.Context, namespace, name string) (runtime.Object, error)
   }
   ```
   `builderAdmission` gains a third map (`getters map[schema.GroupVersion]APIGroupGetter`), populated by `NewAdmissionFromBuilders` the same way `mutators`/`validators` are today (type-assert each builder). An app's builder implements this by delegating to whatever it already uses to read its own resources — e.g. a builder holding a `grafanarest.Storage` field calls that storage's own `Get`; a builder with only a raw `resource.ResourceClient` (unified storage's RPC client) builds a `resourcepb.ResourceKey{Group, Resource, Namespace, Name}` and calls `Read` directly. Both are small, mechanical, low-risk additions to code that already exists on the builder.
   
   Per the team's plan: new apps get this generated automatically by app-sdk's codegen; existing apps get it added by hand, one small PR per app, as and when each one actually wants to participate.

2. **Detection and synthetic re-dispatch.** In `builderAdmission.Validate` (and `.Admit`, for symmetry with mutating admission), before calling through to the app's own method: if the incoming object's `resourceVersion` equals the sentinel *and* this GV has a registered `APIGroupGetter`, fetch the existing object. If found, build a synthetic `admission.Attributes` — `admission.NewAttributesRecord(obj, existing, a.GetKind(), a.GetNamespace(), a.GetName(), a.GetResource(), a.GetSubresource(), admission.Update, a.GetOperationOptions(), a.IsDryRun(), a.GetUserInfo())` — and call the app's `Validate`/`Mutate` with *that* instead of the original. The app's own Update-flavored business validation (folder's move check, dashboard's folder-change check, whatever exists today or gets added later) now runs for real, because as far as that function can tell, this genuinely is an update with a real old object.
   
   If the Getter reports not-found, or isn't registered for this GV at all, dispatch proceeds completely unchanged — this is purely additive for GVs that opt in, and a no-op for everything else.

3. **The marker, closing the fail-open gap.** Only on a successful synthetic re-dispatch (old object found, opted-in GV, the app's own Update-flavored validation didn't reject it), stamp an internal annotation on the object — same convention as `AnnoKeyGrantPermissions`: present only transiently, stripped before persisting, never actually stored. Storage's `createOrReplace` (the logic already built in this branch's existing 4 commits, unchanged in shape) now *requires* this marker before it engages its Get-then-`GuaranteedUpdate` upsert path. No marker — whether because the GV never opted in, or the object wasn't actually found — means storage behaves exactly as it does today: plain Create, 409 on conflict, regardless of what resourceVersion the client sent. Opt-in participation; fail-closed by default; no resource can silently inherit the admission-bypass bug just by sitting in the same codebase as one that opted in.

### Explicitly out of scope for this effort

- **Folders.** No `APIGroupGetter` implementation for the folder resource, no folder integration test, as part of this work. Folders were the resource used to discover the Critical finding above, purely because they were a convenient "prove it's generic" target — there is no actual Terraform (or other) consumer asking for folder create-or-replace today (checked: `terraform-provider-grafana` has no dedicated folder appplatform resource, only a generic test harness). Folders' authz depth (parent-permission inheritance, Zanzana tuple consistency on move, the move-escalation check itself) makes them expensive to get right for a benefit nobody's asked for. If a real need shows up later, it gets its own focused design and review, informed by what this effort already learned — not bundled into this one's proof of genericity.
- Quota admission still running Create-flavored before any of this runs (per-resource follow-up, unrelated to admission's operation-type classification).
- The pre-existing `ManagerKindTerraform`/`ManagerKindKubectl` `AllowsEdits` no-op in `pkg/storage/unified/apistore/managed.go` (pre-existing gap, not touched here).
- The Terraform provider's own change to actually send the sentinel on Create (separate repo, separate follow-on, once this mechanism exists to call into).

### Testing

- **Mechanism genericity**, proven cheaply: unit tests directly against `builderAdmission` using small fake/synthetic `APIGroupBuilder`s — one implementing `APIGroupGetter`, one not — asserting the synthetic-attributes construction, the marker's presence/absence, and that a non-opted-in GV's dispatch is provably unchanged. This isolates the dispatch logic itself without pulling in any real resource's full validation/authz stack.
- **Real end-to-end proof**, on the resource this effort actually exists for: dashboards. `DashboardsAPIBuilder` implements `APIGroupGetter` via its existing `unified resource.ResourceClient`. An integration test against the real apiserver proves: sentinel-triggered replace succeeds and runs real Update-flavored validation (e.g. the folder-change permission check actually fires when the replace also changes folder); a non-sentinel second Create still 409s; a caller with create-but-not-update rights is rejected.
- Storage-layer tests (already on this branch, from the prior version's review) carry forward with their fixes applied: `tryUpdate` deep-copies the object per `GuaranteedUpdate` retry attempt (fixing a stale/dangling secure-value reference risk `prepareObjectForUpdate` can introduce in-place); the pre-`Get` is dropped in favor of calling `GuaranteedUpdate` with `ignoreNotFound: true` directly (removing a narrow delete/create race, since it already has its own upsert-on-missing branch); the RBAC-denial test is sharpened to deny only `VerbUpdate` (not `VerbCreate` too), so it actually proves what it claims to prove instead of passing for the wrong reason (both confirmed via the prior review's mutation testing).
- The marker-gating itself gets a direct test: a resource's `createOrReplace` must refuse to engage without the marker present, even when the client sends the sentinel — proving the fail-closed property, not just asserting it.

## Open questions

- Exact naming/home of `APIGroupGetter` and the marker annotation — implementation detail, not a design blocker, but should land wherever app-sdk's own conventions expect it, since app-sdk owns the codegen path for new apps per the team's plan.
- Whether `Admit` (mutating admission) actually needs its own synthetic-attributes construction, or whether the same `admission.Attributes` instance flows through both `Admit` and `Validate` phases of the chain such that rewriting once suffices — needs confirming against how the generic apiserver's admission-chain machinery actually threads attributes between phases, before the implementation plan commits to doing this in one place vs. two.
