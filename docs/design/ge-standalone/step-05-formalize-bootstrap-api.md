# Step 05: Formalize bootstrap public API

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana` (OSS) |
| **Depends on** | Step 04 |
| **Blocks** | Steps 06–09 |
| **Behavior change** | None |

## Goal

Stabilize and document `pkg/server/bootstrap` and `pkg/server/wiresets` as the **public OSS surface** for Grafana Enterprise to import. Add compile-time guarantees that external modules can depend on these packages.

## Scope

### In scope

- Add `doc.go` files with explicit stability comments for:
  - `pkg/server/bootstrap` — entrypoints external `main` packages call.
  - `pkg/server/wiresets` — Wire sets external edition wire graphs compose.
- Export any types/functions GE will need that are still unexported:
  - `server.Options`, `api.ServerOptions` are already public — bootstrap config should expose them.
  - Consider `bootstrap.NewServerInitializer()` hook type if GE must supply custom `Initialize` — **prefer** GE owning its own injectors calling the same `server.New` / `ModuleServer` types.
- Add `pkg/server/bootstrap/example_test.go` or `doc_test.go` showing minimal external usage (compile-only example).
- Add `scripts/check-bootstrap-api.sh` (optional) that verifies GE-required symbols exist — or document the contract in README only for this step.
- Update `pkg/server/doc.go` to reference bootstrap/wiresets and note enterprise wire lives in GE repo (not OSS).

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
       "github.com/grafana/grafana/pkg/server/wiresets"
       "github.com/grafana/grafana/pkg/server" // New, Options, ModuleServer, Initialize* patterns
   )
   ```

   List every symbol GE wire injectors reference in today's `wireexts_enterprise.go` that lives in `pkg/server` — ensure none are unexported unnecessarily.

2. **Bootstrap config completeness**

   `RunServerConfig` / `RunTargetConfig` must expose everything CLI flags provide today (packaging, profile, tracing, etc.).

3. **Documentation**

   Create `pkg/server/bootstrap/README.md` (short, for Go developers):
   - How OSS CLI uses bootstrap.
   - How GE `main` will call bootstrap with GE-owned Wire injectors (forward reference to Step 09).

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
- `pkg/server/wiresets/doc.go` (update)
- `pkg/server/doc.go` (update)
- `pkg/server/bootstrap/example_test.go` (new)

## Acceptance criteria

- [ ] Godoc builds for bootstrap and wiresets packages.
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
go test -tags=oss -short ./pkg/server/bootstrap/... ./pkg/server/wiresets/...
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

> Implement Step 05 of `docs/design/ge-standalone/step-05-formalize-bootstrap-api.md`. Document and stabilize the public API of `pkg/server/bootstrap` and `pkg/server/wiresets` for external GE consumption. Add doc.go, README, example test. Do not add GE imports to OSS. Verify all tests and make run-go.
