# Step 01: Extract core wire and OSS wireext packages

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana` (OSS) |
| **Depends on** | — |
| **Blocks** | Step 02 |
| **Behavior change** | None |

## Goal

Restructure OSS Wire so the **core graph lives under bootstrap** and **OSS edition bindings stay outside** at `pkg/server/wireext/`:

| Package | Role |
|---------|------|
| `bootstrap` | *(Step 02)* Server startup lifecycle |
| `bootstrap/wire` | Edition-neutral core provider sets + OSS injectors + generated graph |
| `wireext` | OSS edition bindings only (today's `wireexts_oss.go`) — **outside** bootstrap |

GE will later import `github.com/grafana/grafana/pkg/server/bootstrap/wire` for the core sets and **never** import `wireext`. GE owns its own `pkg/wireext` with enterprise bindings.

This step is a pure refactor — no change to which providers are registered or how the OSS graph composes.

## Target OSS layout (after this step)

```
pkg/server/
  bootstrap/
    wire/
      sets.go           # exported Basic, Server, CLI, Test wire.NewSets
      inject.go         //go:build wireinject && oss — Initialize*, etc.
      wire_gen.go       # generated OSS graph
      doc.go
    # RunServer, RunTarget added in Step 02
  wireext/
    oss.go              # OSS edition bindings (wireExtsBasicSet, module/CLI variants)
    doc.go
  wire.go               # shrink or remove — injectors move to bootstrap/wire/inject.go
  server.go             # Server, ModuleServer types (unchanged)
```

**Why `wireext` sits outside `bootstrap`:** it is OSS-edition-only. Keeping it at `pkg/server/wireext` makes the GE import boundary explicit — GE imports `bootstrap` (startup + core wire), never OSS edition bindings.

**Composition pattern (OSS):**

```go
// pkg/server/bootstrap/wire/inject.go
import wireext "github.com/grafana/grafana/pkg/server/wireext"

func Initialize(...) (*server.Server, error) {
    wire.Build(wire.Server, wireext.Set)  // wireext.Set = today's wireExtsSet
    return &server.Server{}, nil
}
```

## Scope

### In scope

- Create `pkg/server/bootstrap/wire/` with exported sets from `wire.go`:
  - `Basic` (today's `wireBasicSet`)
  - `Server` (today's `wireSet`)
  - `CLI` (today's `wireCLISet`)
  - `Test` (today's `wireTestSet`)
- Move helper functions used only by core sets (e.g. `provideMigrationRegistry`, `otelTracer`) into `bootstrap/wire/`.
- Create `pkg/server/wireext/oss.go` with content from `wireexts_oss.go`:
  - Export a composed `Set` (and `CLSet`, `TestSet`, `ModuleServerSet`, etc. as needed) that includes today's `wireExtsBasicSet` bindings.
  - Injectors in `bootstrap/wire/` import `pkg/server/wireext` and compose `wire.Server + wireext.*` — **recommended pattern** (injectors live with core sets; wireext stays edition-specific).
- Move OSS injectors from `pkg/server/wire.go` to `pkg/server/bootstrap/wire/inject.go`.
- Regenerate Wire (`make gen-go`); generated output lives in `pkg/server/bootstrap/wire/wire_gen.go` (update `make gen-go` / wire tool path if needed).
- Add `doc.go` in `bootstrap/wire` and `wireext` documenting:
  - `bootstrap/wire` — stable public API; GE imports this for core sets.
  - `wireext` — OSS product bindings; **not imported by GE**.

### Out of scope

- `bootstrap.RunServer` / startup orchestration (Step 02).
- Moving or deleting overlaid `wireexts_enterprise.go` (still synced from GE during transition).
- Grafana Enterprise repo changes.
- Renaming providers or changing bindings.

## Implementation tasks

1. **Create `pkg/server/bootstrap/wire/sets.go`** — cut `wireBasicSet`, `wireSet`, `wireCLISet`, `wireTestSet` from `wire.go`.

2. **Create `pkg/server/wireext/oss.go`** — move `wireexts_oss.go` content; export edition sets. Update composition to reference `bootstrap/wire.Server` instead of local `wireSet`.

3. **Create `pkg/server/bootstrap/wire/inject.go`** — move `Initialize`, `InitializeModuleServer`, etc. from `wire.go`; each calls `wire.Build(...)` with `wire.*` + `wireext.*` sets.

4. **Update Wire generation** — point `make gen-go` at `./pkg/server/bootstrap/wire` (or keep `./pkg/server` if wire tool requires parent package; document choice in PR).

5. **Delete `wireexts_oss.go`** once content lives in `wireext/oss.go`.

6. **Enterprise overlay** — `wireexts_enterprise.go` remains overlaid unchanged this step; enterprise build tag path still works.

## Files likely touched

- `pkg/server/bootstrap/wire/sets.go`, `inject.go`, `wire_gen.go`, `doc.go` (new)
- `pkg/server/wireext/oss.go`, `doc.go` (new)
- `pkg/server/wire.go` (shrink or remove)
- `pkg/server/wireexts_oss.go` (deleted)
- `Makefile` (wire gen path, if changed)
- `pkg/server/enterprise_wire_gen.go` (regenerated if enterprise linked)

## Acceptance criteria

- [ ] OSS and enterprise (overlay) Wire generation succeed without provider errors.
- [ ] `wire_gen.go` diff shows no change to provider call order or bindings (paths/package names may differ).
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
go test -tags=oss -short -timeout=10m ./pkg/server/bootstrap/wire/... ./pkg/server/wireext/...

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

> Implement Step 01 of `docs/design/ge-standalone/step-01-extract-wire-packages.md`. Extract core wire sets into `pkg/server/bootstrap/wire`, OSS edition bindings into `pkg/server/wireext`, move injectors to `pkg/server/bootstrap/wire/inject.go`. GE must not be required for this step. Do not move enterprise overlay files. Run integration tests and E2E acceptance smoke before completing.
