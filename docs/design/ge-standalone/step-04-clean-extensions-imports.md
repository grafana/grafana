# Step 04: Clean extensions side-effect imports

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana` (OSS) |
| **Depends on** | Step 03 |
| **Blocks** | Step 05 |
| **Behavior change** | None intended |

## Goal

Remove the now-redundant `pkg/extensions` blank imports from the `pkg/server`
package, so the only load point for the `pkg/extensions` overlay is the binary's
`main`. Preserve enterprise overlay behavior (`extensions.IsEnterprise == true`
when `ext.go` is present) in every entrypoint.

## Background (post–Step 03)

Step 03 already moved the `IsEnterprise` seam out of the `server`/`commands`
layers:

- `bootstrap.SetBuildInfo(opts, packaging, isEnterprise)` takes `isEnterprise` as
  a **parameter** and does **not** import `pkg/extensions`. It sets
  `setting.IsEnterprise = isEnterprise`.
- `pkg/cmd/grafana-server/commands` no longer imports `pkg/extensions`; edition
  metadata arrives via `commands.ServerDeps{ IsEnterprise: ... }`.
- `pkg/cmd/grafana/main.go` **value-imports** `pkg/extensions`, reads
  `extensions.IsEnterprise`, and passes it into `ServerDeps` and the early
  `bootstrap.SetBuildInfo` call. This is the composition root.

`extensions.IsEnterprise` is a package var (`false` in the OSS stub
`pkg/extensions/main.go`, flipped to `true` by the overlay's `init()` in
`pkg/extensions/ext.go`). Its value is correct in a binary **iff the
`pkg/extensions` package is imported somewhere in that binary**, so its `init()`
runs. Go runs each package's `init()` exactly once per binary regardless of how
many packages import it (blank or otherwise) — so multiple blank imports never
cause duplicate side effects; they are simply redundant.

### Remaining OSS blank imports after Step 03

```
pkg/server/server.go:15      _ "…/pkg/extensions"   ← source
pkg/server/wire_gen.go:33    _ "…/pkg/extensions"   ← generated MIRROR of server.go
pkg/server/enterprise_wire_gen.go:363  _ "…/pkg/extensions"  ← overlay-generated (not OSS-owned)
```

Two findings that shape this step:

1. **`pkg/server/wire_gen.go`'s blank import is a mirror of `server.go`'s, not an
   independent source.** Wire preserves package-level blank imports into its
   generated output; the injector source (`wire_subinject_oss.go`) has no
   extensions import of its own. Remove it from `server.go` and run `make gen-go`
   and the generated copy disappears too — there is no separate provider to chase.
   (`pkg/server/bootstrap/wire/wire_gen.go` does **not** blank-import extensions;
   the OSS core graph is already clean.)

2. **`main.go`'s value import is what makes the seam work for the binary.** Because
   `main` imports `pkg/extensions`, the overlay `init()` runs before `main()`, so
   `extensions.IsEnterprise` is correct when `main` reads it. `server.go`'s blank
   import is therefore redundant for the `grafana` binary (server, `target`, and
   `cli` are all the same binary).

OSS must not import Grafana Enterprise, but the neutral `pkg/extensions` stub in
OSS is acceptable.

## Non-goal: do NOT make `bootstrap` the load point

An earlier draft of this step proposed importing `pkg/extensions` inside
`bootstrap.SetBuildInfo` as the "single load point." **Do not do this.** If
`bootstrap` imported `pkg/extensions`, then Grafana Enterprise — which imports
`bootstrap` (Step 05+) — would transitively pull in the OSS `pkg/extensions`
stub, reintroducing exactly the edition coupling this whole effort removes.
`bootstrap` must stay edition-neutral; the edition value is **injected** from the
binary's `main` (Step 03). The single load point is `main`, not `bootstrap`.

## Scope

### In scope

- Remove `_ "github.com/grafana/grafana/pkg/extensions"` from `pkg/server/server.go`.
- Run `make gen-go`; confirm the mirrored blank import in `pkg/server/wire_gen.go`
  is gone and nothing reintroduces it.
- Document in `pkg/extensions/main.go` that this package is an OSS-owned hook
  point overlaid at dev/build time, and that the binary `main` is responsible for
  importing it so the overlay `init()` runs.

### Out of scope

- Adding a `pkg/extensions` import to `bootstrap` (see Non-goal above).
- Deleting the `pkg/extensions` stub.
- Removing the enterprise overlay sync of `ext.go`.
- Changing enterprise feature-gating logic.
- Test-only value imports of `extensions.IsEnterprise` (e.g.
  `pkg/tests/testinfra`) — these are legitimate and stay.

## Implementation tasks

1. **Trace `pkg/extensions` imports** in OSS (non-test, non-overlaid):
   ```bash
   rg 'pkg/extensions"' pkg/ --glob '*.go' --glob '!pkg/extensions/**' --glob '!*_test.go'
   ```
   Expect: `main.go` (value, keep), `server.go` (blank, remove), `wire_gen.go`
   (blank, generated mirror).

2. **Remove the redundant blank import**
   - Delete the `_ "…/pkg/extensions"` line from `pkg/server/server.go`.

3. **Wire regeneration**
   ```bash
   make gen-go
   ```
   - Confirm `pkg/server/wire_gen.go` no longer blank-imports extensions. It
     should drop automatically (it mirrors `server.go`). If it persists, the
     injector source acquired its own blank import — remove it there, do not edit
     the generated file by hand.

4. **Verify `IsEnterprise` still resolves in every entrypoint** (this is the real
   risk of removing the `server.go` import — some entrypoint that builds a server
   without going through `main`):
   - **`grafana` binary** (server / `target` / `cli`): loads extensions via
     `main.go`. OSS → `false`, overlay → `true`.
   - **Integration tests**: `pkg/tests/testinfra` value-imports extensions and
     sets `setting.IsEnterprise` itself — unaffected.
   - **`pkg/server` unit tests**: today these load `pkg/extensions` **only** via
     `server.go`'s blank import (they import neither `extensions` nor `testinfra`).
     After removal:
     - OSS tags: extensions not loaded → `setting.IsEnterprise` stays its default
       `false`, which is the correct OSS value. No server unit test asserts
       enterprise-mode under OSS.
     - Enterprise tags (`make test-enterprise-go`): `enterprise_wire_gen.go`
       imports many `pkg/extensions/*` subpackages, so extensions loads and
       `IsEnterprise == true` regardless of `server.go`.
   - Grep for any server-package test that reads `setting.IsEnterprise` /
     `extensions.IsEnterprise` to confirm none relied on the blank import.

5. **Confirm the only runtime reader is unaffected.** The single non-test reader of
   `setting.IsEnterprise` is `pkg/infra/metrics/metrics.go`
   (`SetBuildInformation`, the `build_info` edition label). It runs *after*
   `bootstrap.SetBuildInfo` sets the flag, so the metric label stays correct.

## Files likely touched

- `pkg/server/server.go` (remove blank import)
- `pkg/server/wire_gen.go` (regenerated — mirror drops)
- `pkg/extensions/main.go` (comment only)
- `pkg/server/enterprise_wire_gen.go` (regenerated if overlay linked; keeps its
  own extensions imports — expected)

## Acceptance criteria

- [ ] OSS build: `setting.IsEnterprise == false` at runtime (build_info metric
      edition = `oss`; startup logs / API report non-enterprise).
- [ ] Enterprise overlay build: `setting.IsEnterprise == true`; licensing
      endpoints behave as before.
- [ ] `pkg/server/wire_gen.go` no longer blank-imports `pkg/extensions` after
      `make gen-go`.
- [ ] `bootstrap` still does not import `pkg/extensions` (grep clean).
- [ ] All Step 03 verification commands still pass.
- [ ] `make test-go-integration-postgres SHARD=1 SHARDS=1` passes.
- [ ] `yarn e2e:playwright --grep @acceptance` passes (enterprise overlay linked).

## Verification commands

```bash
make gen-go
make lint-go
make build-backend

# bootstrap must remain extensions-free
! rg -q 'pkg/extensions' pkg/server/bootstrap/

# OSS - confirm not enterprise (grep startup logs or API)
make run-go 2>&1 | head -50

go test -tags=oss -short ./pkg/server/...

# Enterprise overlay
make build-backend
make run-go 2>&1 | head -50
make test-enterprise-go
```

### Integration & E2E (required)

```bash
# Prerequisites: make devenv sources=postgres_tests; enterprise overlay linked; make build-js

make test-go-integration-postgres SHARD=1 SHARDS=1
yarn e2e:playwright --grep @acceptance
```

## Rollback

Restore the blank import in `pkg/server/server.go` and run `make gen-go`.

## LLM prompt seed

> Implement Step 04 of `docs/design/ge-standalone/step-04-clean-extensions-imports.md`. Remove the redundant `_ "pkg/extensions"` blank import from `pkg/server/server.go` and regenerate wire (the mirrored blank import in `pkg/server/wire_gen.go` drops automatically). Do NOT add a `pkg/extensions` import to `bootstrap` — the edition value is injected from `main` (Step 03). Verify `setting.IsEnterprise` is false in OSS and true under the enterprise overlay across the binary and both unit-test tag sets.
