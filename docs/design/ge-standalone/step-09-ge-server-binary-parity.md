# Step 09: GE top-level CLI parity

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana-enterprise` (GE) |
| **Depends on** | Step 08 |
| **Blocks** | Steps 10, 12 |
| **Behavior change** | GE binary becomes drop-in CLI alternative for enterprise dev |

## Goal

Expand `grafana-enterprise` **top-level** CLI to match OSS enterprise `grafana` binary capabilities beyond `server` / `server target` (already shared via OSS `commands` since Steps 06–08): `cli` passthrough, operators registration, version/buildinfo ldflags, and packaging metadata.

**Note:** Server subcommands and flags are **not** reimplemented here — they come from `github.com/grafana/grafana/pkg/cmd/grafana-server/commands`.

## Scope

### In scope

- Structure GE `main` like OSS `pkg/cmd/grafana/main.go` for **edition-specific** subcommands:
  - `grafana-enterprise server` / `server target` — already via `commands.ServerCommand(buildInfo, deps)` (Step 06/08)
  - `grafana-enterprise cli` — import OSS `pkg/cmd/grafana-cli/commands` passthrough (or documented subset)
  - Link flags: `version`, `commit`, `enterpriseCommit`, `buildBranch`, `buildstamp`
- Register GE operators init (today's `pkg/operators/enterprise_register.go`) in GE main via blank import.
- Ensure `ServerDeps` uses real GE wire injectors (from Step 08).
- Document dev workflow:
  ```bash
  # Option A: continue OSS overlay + make run
  # Option B: GE binary pointing at OSS homepath
  ./bin/grafana-enterprise server -homepath=../grafana
  ```
- Extend `scripts/compare-cli-help.sh` to cover any intentional top-level differences.

### Out of scope

- `grafana apiserver` subcommand (Step 11).
- Duplicating or forking `pkg/cmd/grafana-server/commands` flags (shared OSS import).
- Bundling frontend assets differently than OSS.
- Removing OSS overlay.

## Implementation tasks

1. **Top-level app assembly** — mirror OSS `MainApp()` pattern:
   ```go
   app.Commands = []*cli.Command{
       gcli.CLICommand(version),                    // optional passthrough
       commands.ServerCommand(buildInfo, deps),     // shared from OSS
   }
   _ "github.com/grafana/grafana-enterprise/pkg/operators"
   ```

2. **Module target verification**
   - Confirm `grafana-enterprise server target -target=<module>` works for at least one enterprise module (`authz-server` or `storage-server`).

3. **Operators registration**
   - Move `enterprise_register.go` to GE module path.
   - Blank import in GE main: `_ "github.com/grafana/grafana-enterprise/pkg/operators"`.
   - Overlay continues copying to OSS `pkg/operators/` until Step 14.

4. **Build integration**
   - GE `Makefile` `build` produces release-quality binary with ldflags.

5. **Parity test script** `scripts/compare-cli-help.sh`:
   ```bash
   diff <(./bin/grafana server --help) <(./bin/grafana-enterprise server --help) || true
   diff <(./bin/grafana --help) <(./bin/grafana-enterprise --help) || true  # document diffs
   ```

## Files likely touched (GE)

- `cmd/grafana-enterprise/main.go`
- `pkg/wire/inject.go` (module server injector if not done in Step 08)
- `pkg/operators/enterprise_register.go` (path update)
- `scripts/compare-cli-help.sh`
- `Makefile`

## Acceptance criteria

- [ ] `grafana-enterprise server` runs enterprise Grafana equivalent to OSS overlay `make run-go`.
- [ ] `grafana-enterprise server target -target=<module>` works for at least one enterprise module.
- [ ] `grafana-enterprise server --help` still matches OSS (regression from Step 06).
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
./bin/grafana-enterprise server --help
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

Revert GE top-level CLI expansion; keep Step 08 server-only main with OSS commands.

## LLM prompt seed

> Implement Step 09 per `docs/design/ge-standalone/step-09-ge-server-binary-parity.md` in grafana-enterprise. Add top-level CLI parity (cli passthrough, operators). Do NOT duplicate server flags — keep OSS commands import. Verify against OSS overlay regression tests, integration tests, and acceptance E2E.
