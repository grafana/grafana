# Notifications → ManagerProperties migration (tracking)

> **Draft / WIP tracking doc.** Remove before this PR leaves draft. Follows the
> rules migration (PR #126737) and extends ManagerProperties support to the
> alerting `notifications` k8s resources.

## Goal

Make the alerting `notifications` k8s resources expose and accept the richer
app-platform `ManagerProperties` (kind + identity) — losslessly — the same way
alert rules now do, so Terraform / git-sync / IaC tooling round-trips through
legacy storage without losing the managing system's identity.

Resources in scope (all under `pkg/registry/apps/alerting/notifications/`):

- [x] `receiver` (contact points) — `ReceiverService`  ← **done** (per-integration: manager
  resolved/persisted per integration, mirroring provenance via `GetReceiverManager`)
- [x] `templategroup` (templates) — `TemplateService`  ← **done**
- [x] `timeinterval` (mute timings) — `MuteTimingService`  ← **reference (done)**
- [x] `routingtree` (notification policies) — `routes.Service`  ← **done**
- [~] `inhibitionrule` — **deferred to a follow-up.** Unlike the others it stores
  provenance inline in the alertmanager config (no provenance store), so the
  ManagerProperties table can't back it without either a stored-config schema
  change or splitting provenance/manager across two stores (divergence risk).
  Left with current provenance-only behavior.

> **Status:** the four store-backed resources (mute timings, templates, routing trees, contact
> points) are migrated end-to-end with unit tests, and each has an integration round-trip test
> (k8s create with `managedBy: terraform` → fresh read preserves kind+identity; legacy provenance
> maps to `api`). Inhibition rules are deferred (see below).

(`historian`, `alertenrichment` don't use provenance — out of scope.)

## Chosen approach (agreed)

Keep the **embedded `Provenance`** field/param as the existing mechanism. Do
**not** add a co-authoritative `Manager` field to the domain/DTO structs that
would have to be maintained in tandem. Instead:

- **Write (atomic, divergence-safe):** thread an explicit, optional
  `manager utils.ManagerProperties` into each service write method. When it is
  rich (`Kind != ManagerKindUnknown`), the service persists via
  `provenanceStore.SetManagerProperties(...)` **in its existing transaction**;
  otherwise it keeps calling `SetProvenance(...)` with the embedded provenance.
- **Read:** service read methods return manager properties as a **separate**
  value (single `utils.ManagerProperties`, or `map[string]ManagerProperties`
  keyed by resource UID) alongside the existing DTOs — mirroring how
  `AlertRuleService.GetAlertRule` / `ListAlertRules` now return them. No new
  field on the DTO.
- **k8s conversions:** on read, set the `grafana.app/managerKind` /
  `grafana.app/managerId` annotations from the returned manager props (falling
  back to `ProvenanceToManagerProperties(provenance)` when absent); on write,
  extract manager props from those annotations and pass them to the service.
- **HTTP provisioning API callers** pass `utils.ManagerProperties{}` (or
  `ProvenanceToManagerProperties(determineProvenance(c))`) so existing
  provenance behavior and the `provenance:write` gate are unchanged.

### Why this is divergence-safe

The shared provenance store already writes **both** columns on every setter
(`SetProvenance` derives + writes a classic `manager_kind`;
`SetManagerProperties` derives + writes `provenance`), so the two views can't
persistently diverge — a row is always internally consistent. Using exactly one
setter per logical write (rich → `SetManagerProperties`, else `SetProvenance`)
preserves that invariant atomically. A later legacy provenance write
intentionally re-derives `manager_kind` to a classic shim (a manual API edit
re-asserts API management). `AllowsEdits` / `Suspended` are not persisted by the
store today (true for rules too) — out of scope.

## Per-resource checklist (file-level)

### timeinterval (mute timings) — reference
- `pkg/services/ngalert/provisioning/mute_timings.go`
  - `CreateMuteTiming` / `UpdateMuteTiming`: add `manager` param; replace the
    `SetProvenance(&mt, …, mt.Provenance)` call (≈L195/L272) with
    `SetManagerProperties` when `manager` is rich.
  - `DeleteMuteTiming` (≈L282): take `manager` instead of/in addition to
    `provenance`.
  - `GetMuteTimings` (≈L75) / `getMuteTimingByName` / `getMuteTimingByUID`:
    also load + return manager props (add `GetManagerPropertiesByType` to the
    store, parallel to `GetProvenances`).
- `pkg/registry/apps/alerting/notifications/timeinterval/conversions.go`
  - `buildTimeInterval`: set manager annotations from manager props.
  - `convertToDomainModel`: extract manager props from annotations.
- `pkg/registry/apps/alerting/notifications/timeinterval/legacy_storage.go`
  - `TimeIntervalService` interface + Create/Update/Delete/List call sites.
- `pkg/services/ngalert/api/api_provisioning.go`: mute-timing handlers pass
  derived/empty manager.
- Tests: `mute_timings_test.go` (SetProvenance expectations at ≈L470/735/807/
  858/1061), api provisioning tests, + a k8s round-trip integration test under
  `pkg/tests/apis/alerting/...`.

### receiver (contact points) — most complex (do last)
Provenance is stored **per integration** and resolved through the alertmanager
config revision (`revision.GetReceiver(uid, prov)`), and the service has its own
`provisoningStore` sub-interface (note: add the manager methods there too).
`models.Receiver.Provenance` stays; thread `manager` into Create/Update/Delete
and `setReceiverProvenance`; surface manager props on read.

### templategroup (templates)
DTO `v1.TemplateGroup.Provenance`; `TemplateService` Create/Update/Delete.

### routingtree (notification policies)
`NotificationPolicyService` Create/Update/Delete/Reset take `provenance` as an
explicit param — thread `manager` alongside. Alertmanager-config backed.

### inhibitionrule
Service Create/Update/Delete; provenance as explicit param. Config backed.

## Shared prerequisite

Add `GetManagerPropertiesByType(ctx, org, resourceType) (map[string]utils.ManagerProperties, error)`
to `ProvisioningStore` (concrete `DBstore`, the mockery mock, and the test
fake), paralleling `GetProvenances`, for efficient bulk reads.
