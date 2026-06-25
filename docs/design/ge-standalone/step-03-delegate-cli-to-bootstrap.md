# Step 03: Delegate CLI to bootstrap + injectable ServerDeps

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana` (OSS) |
| **Depends on** | Step 02 |
| **Blocks** | Step 04 |
| **Behavior change** | None (delegate only) |

## Goal

Make `pkg/cmd/grafana-server/commands` thin wrappers around `pkg/server/bootstrap`, and introduce an **injectable `ServerDeps`** so Grafana Enterprise can import the same commands package later (Step 06) without hardcoding OSS wire or `pkg/extensions`.

All server startup behavior flows through bootstrap; commands owns flags and subcommand registration only.

## Scope

### In scope

- Refactor `RunServer` in `cli.go` to call `bootstrap.RunServer`.
- Refactor `RunTargetServer` in `target.go` to call `bootstrap.RunTarget`.
- Introduce **`ServerDeps`** — edition injectors and metadata passed in by each binary's `main`:
  ```go
  type ServerDeps struct {
      Initialize       bootstrap.ServerInitializer
      ModuleInitialize bootstrap.ModuleServerInitializer
      IsEnterprise     bool
  }

  func ServerCommand(buildInfo standalone.BuildInfo, deps ServerDeps) *cli.Command
  func TargetCommand(buildInfo standalone.BuildInfo, deps ServerDeps) *cli.Command
  ```
- Remove hardcoded `server.Initialize` / `server.InitializeModuleServer` from `cli.go` and `target.go`.
- Remove direct `pkg/extensions` import from `buildinfo.go` — `IsEnterprise` comes from `ServerDeps` (OSS `main` passes `extensions.IsEnterprise`).
- Remove duplicated logic from commands package (keep flag definitions in `flags.go`).
- Move `listenToSystemSignals` and `checkPrivileges` into bootstrap if not already done in Step 02.
- Consolidate `SetBuildInfo` — single implementation in bootstrap; commands passes `deps.IsEnterprise` into bootstrap config.
- Update OSS `pkg/cmd/grafana/main.go` to pass `ServerDeps` with OSS wire injectors.
- Ensure `TargetCommand` and `ServerCommand` subcommand structure and `--help` output unchanged.

### Out of scope

- `pkg/cmd/grafana/main.go` changes (except if needed for import cleanup).
- Removing `InitializeAPIServerFactory` hook (Step 12).
- Grafana Enterprise binary.

## Implementation tasks

1. **Add `deps.go`** with `ServerDeps` and update command constructors to accept it.

2. **Update `cli.go`**
   ```go
   func RunServer(opts standalone.BuildInfo, deps ServerDeps, cli *cli.Context) error {
       return bootstrap.RunServer(cli.Context, bootstrap.RunServerConfig{
           BuildInfo:    opts,
           Initialize:   deps.Initialize,
           IsEnterprise: deps.IsEnterprise,
           // map flags from flags.go
       })
   }
   ```

3. **Update `target.go`** similarly for `bootstrap.RunTarget` with `deps.ModuleInitialize`.

4. **Update OSS `main.go`**
   ```go
   import bootstrapwire "github.com/grafana/grafana/pkg/server/bootstrap/wire"

   deps := commands.ServerDeps{
       Initialize:       bootstrapwire.Initialize,
       ModuleInitialize: bootstrapwire.InitializeModuleServer,
       IsEnterprise:     extensions.IsEnterprise,
   }
   commands.ServerCommand(buildInfo, deps)
   ```

5. **Delete dead code** from commands package after delegation (duplicate signal handling, config loading, etc.).

6. **Expand bootstrap tests** to cover integration with `bootstrap/wire.Initialize` using a test hook if needed — or rely on existing `pkg/server/bootstrap/wire` tests.

7. **Manual smoke test** — confirm profiling, tracing, and config override flags still work:
   ```bash
   make run-go -- -h
   ./bin/grafana server -profile -profile-addr=127.0.0.1 -profile-port=6000
   ```

## Files likely touched

- `pkg/cmd/grafana-server/commands/deps.go` (new)
- `pkg/cmd/grafana-server/commands/cli.go`
- `pkg/cmd/grafana-server/commands/target.go`
- `pkg/cmd/grafana-server/commands/buildinfo.go` (may shrink or delete)
- `pkg/cmd/grafana/main.go`
- `pkg/server/bootstrap/*.go` (adjustments from Step 02)

## Acceptance criteria

- [ ] `make run-go` and `make run` (air) start Grafana identically to pre-PR.
- [ ] `grafana server target -target=...` still works for a known module (e.g. `-target=storage-server` if devenv available, or document skip).
- [ ] CLI help text unchanged (`./bin/grafana server --help`).
- [ ] Unit + server package tests pass.
- [ ] Enterprise overlay: `make run-go`, `make test-enterprise-go` pass.
- [ ] `make test-go-integration-postgres SHARD=1 SHARDS=1` passes.
- [ ] `yarn e2e:playwright --grep @acceptance` passes (enterprise overlay linked).

## Verification commands

```bash
make gen-go
make lint-go
make build-backend
make run-go &
sleep 15 && curl -sf http://localhost:3000/api/health && kill %1

go test -tags=oss -short -timeout=10m ./pkg/server/bootstrap/...
go test -tags=oss -short -timeout=10m ./pkg/cmd/grafana-server/...

# Enterprise
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

Restore `cli.go` / `target.go` inline implementations; keep bootstrap package unused.

## LLM prompt seed

> Implement Step 03 of `docs/design/ge-standalone/step-03-delegate-cli-to-bootstrap.md`. Delegate `RunServer` and `RunTargetServer` to `pkg/server/bootstrap`. Add injectable `ServerDeps` to commands; remove hardcoded wire and extensions imports from commands. Update OSS main to pass OSS wire injectors. No behavior changes. Verify OSS and enterprise overlay builds and runs.
