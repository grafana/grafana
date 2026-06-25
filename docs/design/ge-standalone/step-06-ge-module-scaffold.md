# Step 06: GE module scaffold + shared server CLI

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana-enterprise` (GE) |
| **Depends on** | Step 05 (OSS bootstrap + injectable commands API published on branch GE can pin) |
| **Blocks** | Step 07 |
| **Behavior change** | None for OSS overlay builds |

## Goal

Add a root Go module to Grafana Enterprise and a **`grafana-enterprise` binary that uses the same OSS `server` CLI** as `./bin/grafana server` — same subcommands, flags, and `--help` — by importing `github.com/grafana/grafana/pkg/cmd/grafana-server/commands` with **stub wire injectors**.

The server does not need to start successfully yet; proving CLI parity and module import is the milestone.

## Scope

### In scope

- Create `go.mod` at GE repo root:
  ```go
  module github.com/grafana/grafana-enterprise

  go 1.26.4

  require github.com/grafana/grafana vX.Y.Z // pin to OSS release or pseudo-version from branch
  ```
- Create `cmd/grafana-enterprise/main.go` that imports OSS commands:
  ```go
  import (
      "github.com/grafana/grafana/pkg/cmd/grafana-server/commands"
      "github.com/grafana/grafana/pkg/services/apiserver/standalone"
  )

  func main() {
      buildInfo := standalone.BuildInfo{ /* ldflags */ }

      deps := commands.ServerDeps{
          Initialize:       stubInitialize,       // returns clear error or minimal noop
          ModuleInitialize: stubModuleInitialize,
          IsEnterprise:     true,
      }

      app := &cli.App{
          Name: "grafana-enterprise",
          Commands: []*cli.Command{
              commands.ServerCommand(buildInfo, deps),
          },
      }
      app.Run(os.Args)
  }
  ```
- Stub initializers must satisfy the `bootstrap.ServerInitializer` signature; returning a descriptive error (e.g. `"wire not configured — see Step 08"`) is acceptable.
- Add `Makefile` targets:
  - `make build` → builds `bin/grafana-enterprise`
  - `make test` → `go test ./...`
- Add `scripts/compare-cli-help.sh` comparing OSS vs GE server help:
  ```bash
  diff <(../grafana/bin/grafana server --help) <(./bin/grafana-enterprise server --help)
  ```
- Add GE CI job building the binary and running help comparison (when OSS sibling available).
- **Optional local dev:** document `go.work` pairing with sibling OSS checkout.

### Out of scope

- Real Wire injectors or enterprise services (Step 08).
- Full top-level CLI parity (`grafana cli`, `apiserver` — Steps 09, 11).
- Changes to OSS overlay scripts (must still work unchanged).
- Replacing OSS `make run` workflow.
- Frontend.

## Implementation tasks

1. **Choose OSS dependency pin**
   - For development: `replace github.com/grafana/grafana => ../grafana` in `go.mod` (local only) or use `go.work`.
   - For CI: pin to OSS commit SHA via pseudo-version after Step 05 merges.

2. **Implement stub initializers** in GE (e.g. `pkg/stub/wire.go`):
   ```go
   func Initialize(ctx context.Context, cfg *setting.Cfg, opts server.Options, apiOpts api.ServerOptions) (*server.Server, error) {
       return nil, fmt.Errorf("grafana-enterprise wire not configured")
   }
   ```

3. **Wire GE main** to OSS `commands.ServerCommand` — do **not** duplicate flags or reimplement `RunServer`.

4. **GE CI job** (Drone/GitHub Actions in GE repo):
   ```bash
   go build -o bin/grafana-enterprise ./cmd/grafana-enterprise
   ./bin/grafana-enterprise server --help
   go test ./...
   ```

5. **Verify OSS unaffected**
   - No changes required in OSS repo for this step except optionally documenting the pin in `docs/design/ge-standalone/`.

## Files likely touched (GE repo)

- `go.mod` (new)
- `go.sum` (new)
- `cmd/grafana-enterprise/main.go` (new)
- `pkg/stub/wire.go` (new — temporary until Step 08)
- `Makefile` (new or extend root Makefile)
- `scripts/compare-cli-help.sh` (new)
- `.github/workflows/` or `.drone.yml` (new job)

## Acceptance criteria

- [ ] `go build ./cmd/grafana-enterprise` succeeds in GE repo.
- [ ] `./bin/grafana-enterprise server --help` matches OSS `./bin/grafana server --help` (byte-for-byte or documented diff).
- [ ] `./bin/grafana-enterprise server -v` prints version metadata.
- [ ] `./bin/grafana-enterprise server -homepath=../grafana` fails with stub error (not a panic or missing-flag error).
- [ ] OSS repo: all Step 05 verification commands still pass (no OSS code changes required).
- [ ] Overlay workflow unchanged: `make enterprise-dev` + OSS `make run-go` still works.
- [ ] OSS regression: `make test-go-integration-postgres SHARD=1 SHARDS=1` passes.
- [ ] OSS regression: `yarn e2e:playwright --grep @acceptance` passes (enterprise overlay linked).

## Verification commands

### GE repo

```bash
cd ../grafana-enterprise
# With replace to local OSS:
go work init . ../grafana   # local dev only
go mod tidy
go build -o bin/grafana-enterprise ./cmd/grafana-enterprise
./bin/grafana-enterprise server --help
./bin/grafana-enterprise server -v
./bin/grafana-enterprise server -homepath=../grafana  # expect stub error
./scripts/compare-cli-help.sh
go test ./...
```

### OSS repo (regression)

```bash
cd ../grafana
make gen-go
make build-backend
./bin/grafana server --help
make run-go &
sleep 15 && curl -sf http://localhost:3000/api/health && kill %1
```

### Enterprise overlay (regression)

```bash
make enterprise-dev   # background
make build-backend
make run-go &
sleep 15 && curl -sf http://localhost:3000/api/health && kill %1
```

### Integration & E2E (required — OSS regression)

```bash
# Prerequisites: make devenv sources=postgres_tests; enterprise overlay linked; make build-js

make test-go-integration-postgres SHARD=1 SHARDS=1
yarn e2e:playwright --grep @acceptance
```

## Rollback

Remove `go.mod`, `cmd/grafana-enterprise/`, CI job from GE repo.

## LLM prompt seed

> Implement Step 06 in **grafana-enterprise** per `docs/design/ge-standalone/step-06-ge-module-scaffold.md`. Add root go.mod and `grafana-enterprise` binary importing OSS `pkg/cmd/grafana-server/commands` with stub `ServerDeps`. Same `server --help` as OSS. Do not duplicate flags. Do not modify OSS overlay. Verify GE builds independently and OSS make run-go still works.
