# Step 02: Bootstrap package skeleton

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana` (OSS) |
| **Depends on** | Step 01 |
| **Blocks** | Step 03 |
| **Behavior change** | None (additive only) |

## Goal

Create `pkg/server/bootstrap` containing server startup logic extracted from the CLI commands, but **do not** switch `pkg/cmd/grafana-server/commands` to use it yet. Both old and new code paths can coexist briefly; this PR only adds the startup orchestration to the bootstrap package root.

Step 01 established `pkg/server/bootstrap/wire/` (core graph) and `pkg/server/wireext/` (OSS edition bindings). This step adds `RunServer`, `RunTarget`, and helpers alongside the existing `bootstrap/wire` sub-package.

## Scope

### In scope

- New package `pkg/server/bootstrap` with types and functions mirroring current CLI behavior:
  - `BuildInfo` — reuse or alias `standalone.BuildInfo` (avoid duplicate structs long-term).
  - `ServerOptions` — pid file, version metadata (mirror `server.Options`).
  - `RunServer(ctx, cfg RunServerConfig) error` — full server path (today's `RunServer` in `cli.go`).
  - `RunTarget(ctx, cfg RunTargetConfig) error` — module target path (today's `RunTargetServer` in `target.go`).
- Extract shared helpers used by both:
  - Config loading (`setting.NewCfgFromArgs` + CLI flags)
  - Metrics build info registration
  - OpenFeature / feature flag init
  - Privilege check
  - Signal handling (`listenToSystemSignals` pattern)
  - Panic recovery wrapper
- Unit tests for pure helpers (e.g. config option parsing) where feasible.

### Out of scope

- Modifying `cli.go` / `target.go` to call bootstrap (Step 03).
- Changing `pkg/cmd/grafana/main.go`.
- Grafana Enterprise repo.

## Implementation tasks

1. **Read source of truth**
   - `pkg/cmd/grafana-server/commands/cli.go` — `RunServer`
   - `pkg/cmd/grafana-server/commands/target.go` — `RunTargetServer`
   - `pkg/cmd/grafana-server/commands/buildinfo.go` — `SetBuildInfo`
   - `pkg/cmd/grafana-server/commands/flags.go` — global CLI flags

2. **Design `bootstrap` API**

   ```go
   package bootstrap

   type RunServerConfig struct {
       BuildInfo   standalone.BuildInfo
       ConfigFile  string
       HomePath    string
       PidFile     string
       ConfigOverrides string
       ExtraArgs   []string
   }

   type ServerInitializer func(context.Context, *setting.Cfg, server.Options, api.ServerOptions) (*server.Server, error)
   type ModuleServerInitializer func(*setting.Cfg, server.Options, api.ServerOptions) (*server.ModuleServer, error)

   type RunServerConfig struct {
       // ...
       Initialize ServerInitializer // required; OSS CLI passes bootstrap/wire.Initialize in Step 03
   }

   func RunServer(ctx context.Context, cfg RunServerConfig) error
   func RunTarget(ctx context.Context, cfg RunTargetConfig) error
   ```

   - Call `cfg.Initialize` / `cfg.ModuleInitialize` — **do not** hardcode `bootstrap/wire.Initialize` inside bootstrap root (GE will supply its own injectors later).
   - Internally call `(*Server).Run`, signal handling, etc. after initialization.
   - Call `commands.SetBuildInfo` or move `SetBuildInfo` logic into bootstrap (prefer moving to avoid import cycle: bootstrap should not import `commands`).

3. **Resolve import cycles**
   - If `SetBuildInfo` lives in `commands` and imports `extensions`, move edition-neutral build info setting into `bootstrap` or `setting` package.
   - `bootstrap` may import: `server`, `setting`, `api`, `featuremgmt`, `metrics`, `standalone`, `extensions` (OSS stub).

4. **Add tests**
   - `bootstrap/buildinfo_test.go` — verify version/commit fields set on `setting.*`.
   - Table tests for config arg merging if extracted.

5. **Do not wire CLI yet** — confirm `cli.go` is untouched except possibly shared constant moves.

## Files likely touched

- `pkg/server/bootstrap/bootstrap.go` (new)
- `pkg/server/bootstrap/target.go` (new)
- `pkg/server/bootstrap/buildinfo.go` (new, if moved from commands)
- `pkg/server/bootstrap/bootstrap_test.go` (new)
- Possibly `pkg/cmd/grafana-server/commands/buildinfo.go` (only if shared logic moved — keep CLI calling old path for now)

## Acceptance criteria

- [ ] New package compiles; no CLI behavior change.
- [ ] Unit tests for bootstrap pass.
- [ ] All existing verification commands unchanged from Step 01.
- [ ] No import cycles (`go build ./pkg/server/bootstrap/...`).
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
go test -tags=oss -short -timeout=10m ./pkg/server/...
make test-go-unit SHARD=1 SHARDS=1

# Enterprise overlay
make test-enterprise-go
```

### Integration & E2E (required)

```bash
# Prerequisites: make devenv sources=postgres_tests; enterprise overlay linked; make build-js

make test-go-integration-postgres SHARD=1 SHARDS=1
yarn e2e:playwright --grep @acceptance
```

Enterprise overlay: same unit/integration/E2E checks as Step 01 global invariants.

## Rollback

Delete `pkg/server/bootstrap/`; revert any moved helpers.

## LLM prompt seed

> Implement Step 02 of `docs/design/ge-standalone/step-02-bootstrap-package-skeleton.md`. Add `pkg/server/bootstrap` by extracting logic from `cli.go` and `target.go`, but do not change CLI entrypoints yet. Avoid import cycles. Add unit tests. Verify `make run-go` still works unchanged.
