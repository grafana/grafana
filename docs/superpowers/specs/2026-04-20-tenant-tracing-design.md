# Tenant watcher and tenant deleter tracing

**Date:** 2026-04-20
**Files touched:** `pkg/storage/unified/resource/tenant_watcher.go`, `pkg/storage/unified/resource/tenant_deleter.go`
**Goal:** performance tracing — identify slowness when tenants have many resources (labelling) or when clusters have many pending-delete records / large tenant data sets (deletion).

## Conventions

- Use the existing package-level `tracer` from `pkg/storage/unified/resource/server.go:39`
  (`otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/resource")`).
- Span name format: `resource.tenantWatcher.<method>` / `resource.tenantDeleter.<method>`, matching the
  `resource.dataStore.<method>` pattern already in `datastore.go`.
- Pass known-at-entry attributes via `trace.WithAttributes(...)` on `tracer.Start`. Set counts and
  outcomes via `span.SetAttributes(...)` at the end of the function, before `span.End()`.
- `defer span.End()` immediately after `Start`.
- Do **not** call `span.RecordError` or set status codes — existing tracing in this package doesn't,
  and introducing a divergent pattern is out of scope. Errors remain logged via `td.log` / `tw.log`.

## tenant_watcher.go spans

Informer handlers run without a caller-provided context. `handleTenant` starts a root span from
`tw.ctx` — one tree per tenant event — and threads the resulting `ctx` into downstream methods so
their spans nest properly.

**Signature changes required** to enable nesting. The following private methods gain `ctx context.Context`
as their first parameter; callers stop relying on `tw.ctx` and use the passed ctx:

- `reconcileTenantPendingDelete(ctx, name, deleteAfter)`
- `clearTenantPendingDelete(ctx, name)`
- `tenantResourcesEditPendingDeleteLabel(ctx, tenantName, addLabel)`
- `editResourceLabel(ctx, dataKey, addLabel)`
- `doEditResourceLabel(ctx, dataKey, addLabel)`

`tw.ctx` is still held on the struct (used by the informer factory lifecycle) but private methods
take ctx explicitly. `handleTenant` becomes the single ctx-origination point for event-driven work.

| Span | Start attributes | End attributes |
|---|---|---|
| `resource.tenantWatcher.handleTenant` | `tenant`, `pending_delete` (bool) | — |
| `resource.tenantWatcher.reconcileTenantPendingDelete` | `tenant`, `delete_after` | `labeling_was_complete` (bool — true if fast-path hit) |
| `resource.tenantWatcher.clearTenantPendingDelete` | `tenant` | `had_record` (bool), `orphaned` (bool) |
| `resource.tenantWatcher.tenantResourcesEditPendingDeleteLabel` | `tenant`, `add_label` (bool) | `group_resource_count` (int), `resource_count` (int — total resources iterated) |

**Explicitly not traced** (too chatty, not the bottleneck we're hunting):

- `editResourceLabel` / `doEditResourceLabel` — per-resource spans would produce thousands of spans
  for large tenants. The aggregate time shows on `tenantResourcesEditPendingDeleteLabel` via
  `resource_count`.
- `pendingDeleteStore.Upsert / Get / Delete / Has / RefreshCache` — fast KV ops, not the target.

The key span for diagnosing slow labelling is `tenantResourcesEditPendingDeleteLabel`. With
`resource_count` and span duration, we can compute edits/sec and see whether the slowness is in
one specific `group/resource` type (visible in the span's own duration) or across the board.

## tenant_deleter.go spans

`runDeletionPass` runs from the context passed into `Start(ctx)`. Each tick is one span tree.

| Span | Start attributes | End attributes |
|---|---|---|
| `resource.tenantDeleter.runDeletionPass` | `dry_run` (bool) | `pending_record_count` (int — total records listed), `eligible_count` (int — passed expiry + gcom), `deleted_count` (int) |
| `resource.tenantDeleter.gcomAllowsTenantDeletion` | `tenant`, `gcom_instance_id` | `gcom_status` (string), `allowed` (bool) |
| `resource.tenantDeleter.deleteTenant` | `tenant`, `dry_run` | `group_resource_count` (int), `total_keys` (int — summed across all group resources) |
| `resource.tenantDeleter.deleteTenantGroupResource` | `tenant`, `group`, `resource`, `dry_run` | `key_count` (int) |

`deleteTenantGroupResource` is a **new function**, extracted from the existing loop body inside
`deleteTenant`. Extraction keeps the span tied to a clean lexical scope and makes
`defer span.End()` safe. The function body is the existing prefix-list + batchDelete (or dry-run
log) for one `GroupResource`. Signature:

```go
func (td *TenantDeleter) deleteTenantGroupResource(ctx context.Context, tenantName string, gr GroupResource) (keyCount int, err error)
```

`deleteTenant` calls it in a loop, accumulating `keyCount` into `total_keys` for the parent span.

**Explicitly not traced:**

- `pendingDeleteStore.Get / Upsert / Delete` in `deleteTenant` — fast KV ops.
- `pendingDeleteStore.kv.Keys` iteration in `runDeletionPass` — the surrounding `runDeletionPass`
  span covers it; per-record child spans would create one span per pending tenant.

## Tests

Add unit tests using the in-tree fake tracer utility (`pkg/infra/tracing` has a test helper;
exact import to be confirmed during implementation). Coverage:

- `tenant_watcher_test.go`: one test that invokes `reconcileTenantPendingDelete` through the
  existing test harness and asserts a `resource.tenantWatcher.reconcileTenantPendingDelete` span
  is recorded with `tenant` and `delete_after` attributes, plus a nested
  `tenantResourcesEditPendingDeleteLabel` span with `resource_count` set.
- `tenant_deleter_test.go`: one test that runs a deletion pass for a tenant with one
  `GroupResource` containing N keys and asserts the parent pass span, a `deleteTenant` child,
  and a `deleteTenantGroupResource` grandchild with `key_count == N`.

Existing tests should continue to pass with no changes — the tracer noops when no provider is set.

## Risk / rollout

- Zero behavior change when no tracer provider is registered (spans are no-ops).
- Span volume per pass is roughly `1 + pending_tenants * (1 gcom + 1 deleteTenant + N group-resources)`.
  Per tenant event in the watcher: `1 + 1 reconcile-or-clear + 1 edit-label` = 3 spans. No explosive
  per-resource fan-out.
- No public API changes. Private method signatures in `TenantWatcher` gain a `ctx` parameter
  (see tenant_watcher.go section).
