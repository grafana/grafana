# Step 05: Formalize bootstrap, wire, and commands API

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana` (OSS) |
| **Depends on** | Step 04 |
| **Blocks** | Steps 06–09 |
| **Behavior change** | None |

## Goal

Stabilize and document `pkg/server/bootstrap` (startup + core wire), and **`pkg/cmd/grafana-server/commands`** as the **public OSS surface** for Grafana Enterprise to import. Add compile-time guarantees that external modules can depend on these packages.

**GE import contract:**

- GE imports `bootstrap` (startup) and `bootstrap/wire` (core sets) + **`commands`** (shared server CLI).
- GE **never** imports `pkg/server/wireext` — it owns `pkg/wireext` with enterprise bindings instead.
- GE passes its own injectors via `commands.ServerDeps`; commands does not hardcode wire or `pkg/extensions`.

## Scope

### In scope

- Add `doc.go` files with explicit stability comments for:
  - `pkg/server/bootstrap` — runtime startup (`RunServer`, `RunTarget`, initializer types).
  - `pkg/server/bootstrap/wire` — core Wire sets external edition injectors compose (`Basic`, `Server`, `CLI`, `Test`).
  - `pkg/server/wireext` — OSS-only edition bindings; document explicitly that GE must not import this package.
  - `pkg/cmd/grafana-server/commands` — shared server CLI (flags, `ServerCommand`, `ServerDeps`); importable by GE `main`.
- Export any types/functions GE will need that are still unexported:
  - `ServerInitializer` / `ModuleServerInitializer` on bootstrap (Step 02–03).
  - `ServerDeps`, `ServerCommand`, `TargetCommand` on commands (Step 03).
- Add `pkg/server/bootstrap/example_test.go` or `doc_test.go` showing minimal external usage (compile-only example).
- Add `scripts/check-bootstrap-api.sh` (optional) that verifies GE-required symbols exist — or document the contract in README only for this step.
- Update `pkg/server/doc.go` to reference `bootstrap`, `wire`, and `wireext`; note enterprise wire lives in GE `pkg/wire` + `pkg/wireext` (not OSS).

### Out of scope

- Grafana Enterprise `go.mod` (Step 06).
- Changing Wire injectors in OSS.
- Removing `wireexts_enterprise.go` overlay file from OSS tree (still synced during transition).

## Implementation tasks

1. **Audit exported API**

   GE will eventually need:
   ```go
   import (
       "github.com/grafana/grafana/pkg/server/bootstrap"
       "github.com/grafana/grafana/pkg/cmd/grafana-server/commands"
       osswire "github.com/grafana/grafana/pkg/server/bootstrap/wire"
       gewire "github.com/grafana/grafana-enterprise/pkg/wire"
       gewireext "github.com/grafana/grafana-enterprise/pkg/wireext"
   )

   deps := commands.ServerDeps{
       Initialize:       gewire.Initialize,       // stub in Step 06; real in Step 08
       ModuleInitialize: gewire.InitializeModuleServer,
       IsEnterprise:     true,
   }
   app.Commands = append(app.Commands, commands.ServerCommand(buildInfo, deps))
   // GE injectors: wire.Build(osswire.Server, gewireext.Set)
   ```

   List every symbol GE wire injectors reference in today's enterprise wire source that lives in `pkg/server` — ensure none are unexported unnecessarily.

2. **Bootstrap config completeness**

   `RunServerConfig` / `RunTargetConfig` must expose everything CLI flags provide today (packaging, profile, tracing, etc.).

3. **Documentation**

   Create `pkg/server/bootstrap/README.md` (short, for Go developers):
   - How OSS CLI uses bootstrap via commands.
   - How GE `main` imports `commands.ServerCommand` with GE-owned injectors in `ServerDeps` (Step 06 stub, Step 08 real wire).

   Add `pkg/cmd/grafana-server/commands/doc.go` noting the package is stable public API for GE server CLI parity.

4. **Compile-only external test**

   Add `pkg/server/bootstrap/external_test.go`:
   ```go
   //go:build ignore
   // +build ignore

   package bootstrap_test

   import "github.com/grafana/grafana/pkg/server/bootstrap"

   var _ = bootstrap.RunServerConfig{}
   ```
   Or use `example_test.go` in same module.

5. **No OSS import of GE** — grep CI/lint rules if any; confirm clean.

## Files likely touched

- `pkg/server/bootstrap/doc.go`
- `pkg/server/bootstrap/README.md` (new)
- `pkg/server/bootstrap/wire/doc.go` (update)
- `pkg/server/wireext/doc.go` (update)
- `pkg/server/doc.go` (update)
- `pkg/server/bootstrap/example_test.go` (new)
- `pkg/cmd/grafana-server/commands/doc.go` (new)

## Acceptance criteria

- [ ] Godoc builds for bootstrap, wire, wireext, and commands packages.
- [ ] No new imports of `pkg/extensions` outside documented hook points.
- [ ] Full OSS + enterprise verification from Step 03 passes.
- [ ] `make build` succeeds if frontend unchanged.
- [ ] `make test-go-integration-postgres SHARD=1 SHARDS=1` passes.
- [ ] `yarn e2e:playwright --grep @acceptance` passes (enterprise overlay linked).

## Verification commands

```bash
make gen-go
make lint-go
make build-backend
make run-go &
sleep 15 && curl -sf http://localhost:3000/api/health && kill %1
go test -tags=oss -short ./pkg/server/bootstrap/... ./pkg/server/wireext/... ./pkg/cmd/grafana-server/...
make test-go-unit SHARD=1 SHARDS=1

# Enterprise
make test-enterprise-go
```

### Integration & E2E (required)

```bash
# Prerequisites: make devenv sources=postgres_tests; enterprise overlay linked; make build-js

make test-go-integration-postgres SHARD=1 SHARDS=1
yarn e2e:playwright --grep @acceptance
```

## Rollback

Revert documentation-only and export changes; no runtime impact if exports were additive.

## LLM prompt seed

> Implement Step 05 of `docs/design/ge-standalone/step-05-formalize-bootstrap-api.md`. Document and stabilize the public API of `pkg/server/bootstrap` (including `bootstrap/wire`), and `pkg/cmd/grafana-server/commands` for external GE consumption. Document that `wireext` is OSS-only. Add doc.go, README, example test. Do not add GE imports to OSS. Verify all tests and make run-go.
