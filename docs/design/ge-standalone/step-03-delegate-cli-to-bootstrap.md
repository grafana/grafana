# Step 03: Delegate CLI to bootstrap

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana` (OSS) |
| **Depends on** | Step 02 |
| **Blocks** | Step 04 |
| **Behavior change** | None (delegate only) |

## Goal

Make `pkg/cmd/grafana-server/commands/cli.go` and `target.go` thin wrappers around `pkg/server/bootstrap`. All server startup behavior flows through bootstrap.

## Scope

### In scope

- Refactor `RunServer` in `cli.go` to call `bootstrap.RunServer`.
- Refactor `RunTargetServer` in `target.go` to call `bootstrap.RunTarget`.
- Remove duplicated logic from commands package (keep flag definitions in `flags.go`).
- Move `listenToSystemSignals` and `checkPrivileges` into bootstrap if not already done in Step 02.
- Consolidate `SetBuildInfo` — single implementation in bootstrap; commands call it or bootstrap sets internally.
- Ensure `TargetCommand` and `ServerCommand` subcommand structure unchanged.

### Out of scope

- `pkg/cmd/grafana/main.go` changes (except if needed for import cleanup).
- Removing `InitializeAPIServerFactory` hook (Step 12).
- Grafana Enterprise binary.

## Implementation tasks

1. **Update `cli.go`**
   ```go
   func RunServer(opts standalone.BuildInfo, cli *cli.Context) error {
       return bootstrap.RunServer(cli.Context, bootstrap.RunServerConfig{
           BuildInfo: opts,
           // map flags from flags.go
       })
   }
   ```

2. **Update `target.go`** similarly for `bootstrap.RunTarget`.

3. **Delete dead code** from commands package after delegation (duplicate signal handling, config loading, etc.).

4. **Expand bootstrap tests** to cover integration with `server.Initialize` using a test hook if needed — or rely on existing `pkg/server` tests.

5. **Manual smoke test** — confirm profiling, tracing, and config override flags still work:
   ```bash
   make run-go -- -h
   ./bin/grafana server -profile -profile-addr=127.0.0.1 -profile-port=6000
   ```

## Files likely touched

- `pkg/cmd/grafana-server/commands/cli.go`
- `pkg/cmd/grafana-server/commands/target.go`
- `pkg/cmd/grafana-server/commands/buildinfo.go` (may shrink or delete)
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

> Implement Step 03 of `docs/design/ge-standalone/step-03-delegate-cli-to-bootstrap.md`. Delegate `RunServer` and `RunTargetServer` to `pkg/server/bootstrap`. Remove duplicated logic from commands. No behavior changes. Verify OSS and enterprise overlay builds and runs.
