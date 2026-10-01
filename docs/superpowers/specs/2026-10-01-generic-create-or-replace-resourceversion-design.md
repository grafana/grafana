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

There isn't one single admission dispatcher today — there are two, chained together. `pkg/services/apiserver/builder/admission.go`'s `builderAdmission` dispatches legacy, hand-written `APIGroupBuilder` resources (dashboards, folders, iam, provisioning, etc.) by GroupVersion. Separately, every app-sdk-native app built through `appsdkapiserver.NewDefaultAppInstaller` (e.g. the alerting historian) carries its *own* `appAdmission` (declared in `grafana-app-sdk`'s `k8s/apiserver/admission.go`), driven by the app's manifest-declared admission capabilities. `pkg/services/apiserver/appinstaller/installer.go`'s `RegisterAdmission` (lines 103-128) combines both into one `admission.NewChainHandler(...)` — this is the actual single choke point that runs *before* any operation-type decision has locked in a Create-flavored code path downstream, and it's where the sentinel-rewrite belongs: wrapping the whole assembled chain once, rather than duplicating the rewrite logic inside both `builderAdmission` and app-sdk's `appAdmission` separately.

Getting at the "existing object to validate against" splits into two tracks, because the two app families have fundamentally different storage shapes:

### Track 1 — legacy `APIGroupBuilder` apps (bespoke, opt-in)

A new interface, analogous to the existing `APIGroupMutation`/`APIGroupValidation` pattern:
```go
type APIGroupGetter interface {
    Get(ctx context.Context, namespace, name string) (runtime.Object, error)
}
```
`builderAdmission` gains a third map (`getters map[schema.GroupVersion]APIGroupGetter`), populated by `NewAdmissionFromBuilders` the same way `mutators`/`validators` are today. Each builder implements this by delegating to whatever it already uses to read its own resources — e.g. a builder holding a `grafanarest.Storage` field calls that storage's own `Get`; `DashboardsAPIBuilder` (no single canonical storage field — it registers separate storage per API version) builds a `resourcepb.ResourceKey{Group, Resource, Namespace, Name}` and calls its existing `unified resource.ResourceClient`'s `Read` directly. Both are small, mechanical, low-risk additions to code that already exists on the builder — opt-in, one small PR per app, as and when each one wants to participate. This is the bespoke solution the legacy path needs, confirmed cheap for both resources actually checked (folders, dashboards).

### Track 2 — app-sdk-native apps (generic, zero per-app code)

`appsdkapiserver.AppInstaller`'s own internals (`k8s/apiserver/storage.go`'s `newGenericStoreForKind`) already build a standard vendor `*genericregistry.Store` for every kind an app-sdk app declares — which already satisfies `rest.Getter` via its own `.Get` method, automatically, for every such app, with zero per-app code written today. The gap is that `AppInstaller`'s public interface (`k8s/apiserver/installer.go:57-79`) never hands that store back out — `InstallAPIs` installs it into the server and returns nothing.

Closing that gap means a small addition **in `grafana-app-sdk` itself** (not grafana/grafana): have the installer retain the stores it builds and expose one new generic method (on `AppInstaller` or a new optional interface alongside it) that looks up a kind's store by GVR and calls its `.Get`. Implemented once, in app-sdk's own installer, this automatically covers every current and future app-sdk-native app — no codegen needed, no per-app PR, because the capability already exists structurally; it's just not exposed yet. This needs prototyping against a local `grafana-app-sdk` checkout with a `go.mod replace` before committing to the exact method shape, then a real dependency version bump once it lands there.

### Detection, re-dispatch, and the marker (shared by both tracks)

At the `RegisterAdmission` chain-wrapping point: if the incoming object's `resourceVersion` equals the sentinel *and* either Getter source (Track 1's per-builder map, or Track 2's app-sdk-exposed lookup) has an entry for this GV, fetch the existing object. If found, build a synthetic `admission.Attributes` — `admission.NewAttributesRecord(obj, existing, a.GetKind(), a.GetNamespace(), a.GetName(), a.GetResource(), a.GetSubresource(), admission.Update, a.GetOperationOptions(), a.IsDryRun(), a.GetUserInfo())` — and invoke the assembled chain with *that* instead of the original. Each app's own Update-flavored business validation (folder's move check, dashboard's folder-change check, whatever exists today or gets added later, for either app family) now runs for real, because as far as that validation can tell, this genuinely is an update with a real old object.

If neither Getter source has an entry for this GV, or the object isn't found, dispatch proceeds completely unchanged — purely additive for whichever GVs opt in (Track 1) or get the app-sdk capability (Track 2 — effectively all of them, once that lands), a no-op for everything else.

Only on a successful synthetic re-dispatch (old object found, a Getter existed, the real Update-flavored validation didn't reject it), stamp an internal annotation on the object — same convention as `AnnoKeyGrantPermissions`: present only transiently, stripped before persisting, never actually stored. Storage's `createOrReplace` (the logic already built in this branch's existing 4 commits, unchanged in shape) now *requires* this marker before it engages its Get-then-`GuaranteedUpdate` upsert path. No marker means storage behaves exactly as it does today: plain Create, 409 on conflict, regardless of what resourceVersion the client sent. Fail-closed by default; no resource can silently inherit the admission-bypass bug just by sitting in the same codebase as one that opted in.

### Explicitly out of scope for this effort

- **Folders.** No `APIGroupGetter` implementation for the folder resource, no folder integration test, as part of this work. Folders were the resource used to discover the Critical finding above, purely because they were a convenient "prove it's generic" target — there is no actual Terraform (or other) consumer asking for folder create-or-replace today (checked: `terraform-provider-grafana` has no dedicated folder appplatform resource, only a generic test harness). Folders' authz depth (parent-permission inheritance, Zanzana tuple consistency on move, the move-escalation check itself) makes them expensive to get right for a benefit nobody's asked for. If a real need shows up later, it gets its own focused design and review, informed by what this effort already learned — not bundled into this one's proof of genericity.
- Quota admission still running Create-flavored before any of this runs (per-resource follow-up, unrelated to admission's operation-type classification).
- The pre-existing `ManagerKindTerraform`/`ManagerKindKubectl` `AllowsEdits` no-op in `pkg/storage/unified/apistore/managed.go` (pre-existing gap, not touched here).
- The Terraform provider's own change to actually send the sentinel on Create (separate repo, separate follow-on, once this mechanism exists to call into).

### Testing

- **Mechanism genericity (chain-wrapping logic), proven cheaply:** unit tests directly against the `RegisterAdmission` wrapper using small fake Getter sources for each track — one GV with a Track-1-style entry, one with a Track-2-style entry, one with neither — asserting the synthetic-attributes construction, the marker's presence/absence, and that a GV with no Getter at all dispatches completely unchanged. Isolates the rewrite logic itself without pulling in any real resource's full validation/authz stack.
- **Track 1 real end-to-end proof**, on the resource this effort actually exists for: dashboards. `DashboardsAPIBuilder` implements `APIGroupGetter` via its existing `unified resource.ResourceClient`. An integration test against the real apiserver proves: sentinel-triggered replace succeeds and runs real Update-flavored validation (e.g. the folder-change permission check actually fires when the replace also changes folder); a non-sentinel second Create still 409s; a caller with create-but-not-update rights is rejected.
- **Track 2 real end-to-end proof**, once the `grafana-app-sdk` addition lands (own PR, own tests in that repo first): an integration test against an app-sdk-native app (the alerting historian, or whichever is simplest to exercise) proving the same three properties as Track 1, with zero Getter code written on the Grafana-core side for that app.
- Storage-layer tests (already on this branch, from the prior version's review) carry forward with their fixes applied: `tryUpdate` deep-copies the object per `GuaranteedUpdate` retry attempt (fixing a stale/dangling secure-value reference risk `prepareObjectForUpdate` can introduce in-place); the pre-`Get` is dropped in favor of calling `GuaranteedUpdate` with `ignoreNotFound: true` directly (removing a narrow delete/create race, since it already has its own upsert-on-missing branch); the RBAC-denial test is sharpened to deny only `VerbUpdate` (not `VerbCreate` too), so it actually proves what it claims to prove instead of passing for the wrong reason (both confirmed via the prior review's mutation testing).
- The marker-gating itself gets a direct test: a resource's `createOrReplace` must refuse to engage without the marker present, even when the client sends the sentinel — proving the fail-closed property, not just asserting it.

## Cross-repo dependency

Track 2 requires a change in `grafana-app-sdk` (separate repo) before grafana/grafana can consume it. Sequencing: prototype the new `AppInstaller` capability against a local clone with a `go.mod replace` directive, validate it against a real app-sdk-native app, land it as its own PR in `grafana-app-sdk` with its own tests, then bump the real dependency version in `go.mod` and remove the replace directive. Track 1 (dashboards, the actual escalation target) has no such dependency and can proceed independently — it does not need to wait on Track 2.

## Open questions

- Exact naming/home of `APIGroupGetter` (Track 1) and the new `AppInstaller` capability (Track 2), plus the marker annotation — implementation details, not design blockers, but Track 2's naming should match whatever conventions the app-sdk maintainers already use elsewhere in that package.
- Whether `Admit` (mutating admission) actually needs its own synthetic-attributes construction, or whether the same `admission.Attributes` instance flows through both `Admit` and `Validate` phases of the chain such that rewriting once suffices — needs confirming against how `admission.NewChainHandler` actually threads attributes between phases, before the implementation plan commits to doing this in one place vs. two.
