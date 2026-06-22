# Step 09: GE single-binary CLI parity

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana-enterprise` (GE) |
| **Depends on** | Step 08 |
| **Blocks** | Steps 10, 12 |
| **Behavior change** | GE binary becomes drop-in CLI alternative for enterprise dev |

## Goal

Expand `grafana-enterprise` binary to match the enterprise capabilities of OSS `grafana` CLI: `server`, `server target`, `cli` passthrough (or documented subset), version/buildinfo flags, and packaging metadata.

## Scope

### In scope

- Structure GE `main` like OSS `pkg/cmd/grafana/main.go`:
  - `grafana-enterprise server` → `bootstrap.RunServer` + GE `Initialize`
  - `grafana-enterprise server target` → `bootstrap.RunTarget` + GE `InitializeModuleServer`
  - Link flags: `version`, `commit`, `enterpriseCommit`, `buildBranch`, `buildstamp`
- Port or share `pkg/cmd/grafana-server/commands/flags.go` behavior — duplicate flag definitions in GE (no OSS import of commands package if it creates cycles) or extract shared flags to OSS `pkg/server/bootstrap/flags` (**small OSS PR** if needed).
- Register GE operators init (today's `pkg/operators/enterprise_register.go`) in GE main via blank import.
- Document dev workflow:
  ```bash
  # Option A: continue OSS overlay + make run
  # Option B: GE binary pointing at OSS homepath
  ./bin/grafana-enterprise server -homepath=../grafana
  ```

### Out of scope

- `grafana apiserver` subcommand (Step 11).
- Bundling frontend assets differently than OSS.
- Removing OSS overlay.

## Implementation tasks

1. **CLI framework** — use `urfave/cli/v2` matching OSS.

2. **Module target support**
   - GE `InitializeModuleServer` injector in `pkg/wire/`.
   - `bootstrap.RunTarget` with GE initializer.

3. **Operators registration**
   - Move `enterprise_register.go` to GE module path.
   - Blank import in GE main: `_ "github.com/grafana/grafana-enterprise/pkg/operators"`.
   - Overlay continues copying to OSS `pkg/operators/` until Step 14.

4. **Build integration**
   - GE `Makefile` `build` produces release-quality binary with ldflags.

5. **Parity test script** `scripts/compare-cli-help.sh`:
   ```bash
   diff <(./bin/grafana server --help) <(./bin/grafana-enterprise server --help) || true
   ```
   Document intentional differences.

## Files likely touched (GE)

- `cmd/grafana-enterprise/main.go`
- `pkg/cmd/server/flags.go` (new, mirrored from OSS)
- `pkg/wire/wire.go` (add module server injector if missing)
- `pkg/operators/enterprise_register.go` (path update)
- `Makefile`

## Acceptance criteria

- [ ] `grafana-enterprise server` runs enterprise Grafana equivalent to OSS overlay `make run-go`.
- [ ] `grafana-enterprise server target -target=<module>` works for at least one enterprise module (`authz-server` or `storage-server`).
- [ ] Version output includes enterprise commit when set via ldflags.
- [ ] OSS overlay workflow still passes all regression tests.
- [ ] `make test-enterprise-go` (OSS tree) passes.
- [ ] `make test-go-integration-postgres SHARD=1 SHARDS=1` passes.
- [ ] `yarn e2e:playwright --grep @acceptance` passes (enterprise overlay linked).

## Verification commands

### GE binary

```bash
cd ../grafana-enterprise
make build
./bin/grafana-enterprise server -homepath=../grafana &
sleep 20 && curl -sf http://localhost:3000/api/health && kill %1

# Module target (example)
./bin/grafana-enterprise server target -target=storage-server -homepath=../grafana &
# verify process starts or graceful config error; kill
```

### OSS overlay regression

```bash
cd ../grafana
make enterprise-dev
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

Revert GE CLI expansion; keep Step 08 minimal server-only main.

## LLM prompt seed

> Implement Step 09 per `docs/design/ge-standalone/step-09-ge-server-binary-parity.md` in grafana-enterprise. Full CLI parity with OSS enterprise grafana for server and server target. Register operators. Verify against OSS overlay regression tests, integration tests, and acceptance E2E.
