# Step 01: Export shared wire sets

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana` (OSS) |
| **Depends on** | — |
| **Blocks** | Step 02 |
| **Behavior change** | None |

## Goal

Move edition-neutral Wire provider sets out of `pkg/server/wire.go` into a new importable package `pkg/server/wiresets`, without changing which providers are registered or how injectors compose them.

This is a pure refactor that prepares OSS wire sets for import by Grafana Enterprise later.

## Scope

### In scope

- Create `pkg/server/wiresets/` with exported `wire.NewSet` values mirroring today's unexported sets in `wire.go`:
  - `Basic` (today's `wireBasicSet`)
  - `Server` (today's `wireSet`)
  - `CLI` (today's `wireCLISet`)
  - `Test` (today's `wireTestSet`)
- Update `pkg/server/wire.go` to reference `wiresets.Basic`, `wiresets.Server`, etc.
- Update `pkg/server/wireexts_oss.go` if it references `wireSet` / `wireCLISet` / `wireTestSet` directly.
- Regenerate Wire output (`make gen-go`).
- Add a short `pkg/server/wiresets/doc.go` explaining the package is public API for edition composition.

### Out of scope

- Moving `wireExts*` sets (edition-specific; stay in `wireexts_oss.go` and overlaid `wireexts_enterprise.go`).
- Changing injectors (`Initialize`, etc.).
- Grafana Enterprise repo changes.
- Renaming providers or changing bindings.

## Implementation tasks

1. **Create `pkg/server/wiresets/wiresets.go`**
   - Cut the `var wireBasicSet`, `wireSet`, `wireCLISet`, `wireTestSet` blocks from `wire.go` (including all imports they need).
   - Export as `var Basic`, `Server`, `CLI`, `Test` (or `BasicSet`, `ServerSet`, etc. — pick one naming scheme and use consistently).
   - Move helper functions used only by these sets (e.g. `provideMigrationRegistry`, `otelTracer`) into `wiresets` or a `wiresets/internal` file in the same package.

2. **Update `pkg/server/wire.go`**
   - Replace local set definitions with imports from `wiresets`.
   - Keep injectors and `wireinject` build tag unchanged.
   - Ensure `wireExtsSet` in `wireexts_oss.go` still composes `wiresets.Server` + `wireExtsBasicSet`.

3. **Regenerate Wire**
   ```bash
   make gen-go
   ```
   - Diff `pkg/server/wire_gen.go` — expect import path changes only, no logic changes.
   - If enterprise is linked, `enterprise_wire_gen.go` should also regenerate cleanly.

4. **Document**
   - `wiresets/doc.go`: package is stable public API; edition repos compose these sets with their own extension sets.

## Files likely touched

- `pkg/server/wire.go` (shrink)
- `pkg/server/wiresets/wiresets.go` (new)
- `pkg/server/wiresets/doc.go` (new)
- `pkg/server/wireexts_oss.go` (import path updates if needed)
- `pkg/server/wire_gen.go` (regenerated)
- `pkg/server/enterprise_wire_gen.go` (regenerated, if enterprise linked)

## Acceptance criteria

- [ ] OSS and enterprise Wire generation succeed without provider errors.
- [ ] `wire_gen.go` diff shows no change to provider call order or bindings (imports/package names may differ).
- [ ] `make build-backend` succeeds (OSS tags).
- [ ] `make run-go` starts Grafana; `/api/health` returns 200.
- [ ] `go test -tags=oss -short ./pkg/server/...` passes.
- [ ] With enterprise linked: `make build-backend`, `make run-go`, `make test-enterprise-go` pass.
- [ ] `make test-go-integration-postgres SHARD=1 SHARDS=1` passes.
- [ ] `yarn e2e:playwright --grep @acceptance` passes (enterprise overlay linked).

## Verification commands

```bash
# OSS-only
make gen-go
make lint-go
make build-backend
make run-go &
sleep 15 && curl -sf http://localhost:3000/api/health && kill %1
go test -tags=oss -short -timeout=10m ./pkg/server/...

# Enterprise overlay (if available)
make gen-go
make build-backend
make run-go &
sleep 15 && curl -sf http://localhost:3000/api/health && kill %1
make test-enterprise-go
```

### Integration & E2E (required)

```bash
# Prerequisites: make devenv sources=postgres_tests; enterprise overlay linked; make build-js

make test-go-integration-postgres SHARD=1 SHARDS=1
yarn e2e:playwright --grep @acceptance
```

## Rollback

Revert the commit; run `make gen-go` to restore prior generated files.

## LLM prompt seed

> Implement Step 01 of `docs/design/ge-standalone/step-01-export-wire-sets.md`. Extract `wireBasicSet`, `wireSet`, `wireCLISet`, and `wireTestSet` from `pkg/server/wire.go` into `pkg/server/wiresets` as exported variables. Update references, run `make gen-go`, and verify no behavioral change to the Wire graph. Do not move edition-specific `wireExts*` sets. Run integration tests and E2E acceptance smoke before completing.
