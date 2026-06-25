# Step 08: GE wire generation + first server build

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana-enterprise` (GE) |
| **Depends on** | Step 07 |
| **Blocks** | Steps 09, 11 |
| **Behavior change** | Adds GE-built server binary; OSS overlay path must remain working |

## Goal

Run Wire generation in the GE repo, produce `pkg/wire/wire_gen.go`, and **swap stub injectors for real ones** in the existing GE `main` — the binary already uses OSS `commands.ServerCommand` from Step 06; this step makes `./bin/grafana-enterprise server` start the full enterprise Grafana server.

## Scope

### In scope

- Implement `make gen-wire` in GE that generates `pkg/wire/wire_gen.go`.
- Wire GE injectors to completion — resolve all provider errors until generation succeeds.
- Update `cmd/grafana-enterprise/main.go` — replace stub `ServerDeps` with real GE injectors:
  ```go
  deps := commands.ServerDeps{
      Initialize:       gewire.Initialize,
      ModuleInitialize: gewire.InitializeModuleServer,
      IsEnterprise:     true,
  }
  app.Commands = []*cli.Command{
      commands.ServerCommand(buildInfo, deps),
  }
  ```
  No new CLI flag wiring — commands + bootstrap handle that (Step 03/06).
- Remove or replace `pkg/stub/wire.go` from Step 06.
- Copy generated `wire_gen.go` to OSS via overlay script as `enterprise_wire_gen.go` until Step 13.

### Out of scope

- Full top-level CLI parity (`grafana cli` passthrough, apiserver — Steps 09, 11).
- Removing OSS enterprise wire generation (still runs in parallel for safety).
- Frontend assets in GE binary.
- OSS changes (bootstrap and commands APIs finalized in Steps 02–05).

## Implementation tasks

1. **Wire generation loop**
   ```bash
   cd grafana-enterprise
   make gen-wire
   ```
   Fix missing providers by importing additional OSS `bootstrap/wire.*` sets or adding GE `wireext` providers — mirror what enterprise edition bindings do today.

2. **Swap GE main injectors**
   - Import GE `pkg/wire` generated `Initialize` / `InitializeModuleServer`.
   - Pass into existing `commands.ServerDeps` — do not bypass commands or duplicate bootstrap calls.

3. **Update overlay**
   - `enterprise-to-oss.sh`: copy `pkg/wire/wire_gen.go` → `$GRAFANA_DIR/pkg/server/enterprise_wire_gen.go`
   - `enterprise-to-oss.sh`: copy `pkg/wireext/enterprise.go` → OSS `pkg/server/wireexts_enterprise.go`

4. **Binary smoke test**
   ```bash
   go build -tags=enterprise -o bin/grafana-enterprise ./cmd/grafana-enterprise
   ./bin/grafana-enterprise server -homepath=/path/to/oss/grafana
   curl http://localhost:3000/api/health
   ```

## Files likely touched

**GE:**
- `pkg/wire/wire_gen.go` (generated)
- `cmd/grafana-enterprise/main.go` (swap stub → real deps)
- `pkg/stub/wire.go` (delete)
- `Makefile`
- `enterprise-to-oss.sh`, `build.sh`

## Acceptance criteria

- [ ] GE `make gen-wire` succeeds; `wire_gen.go` committed.
- [ ] GE enterprise binary starts full server with enterprise features (license check, enterprise routes).
- [ ] `./bin/grafana-enterprise server --help` still matches OSS (unchanged from Step 06).
- [ ] OSS overlay path: after copy, `make gen-go`, `make build-backend`, `make run-go` still work.
- [ ] `make test-enterprise-go` passes (OSS tree with overlay).
- [ ] GE `go test ./pkg/wire/...` passes if tests exist.
- [ ] `make test-go-integration-postgres SHARD=1 SHARDS=1` passes.
- [ ] `yarn e2e:playwright --grep @acceptance` passes (enterprise overlay linked).

## Verification commands

### GE standalone

```bash
cd ../grafana-enterprise
make gen-wire
make build
./bin/grafana-enterprise server -homepath=../grafana &
sleep 20 && curl -sf http://localhost:3000/api/health && kill %1
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

### Unit tests

```bash
# OSS
go test -tags=oss -short ./pkg/server/bootstrap/... ./pkg/cmd/grafana-server/...

# GE
go test -tags=enterprise -short ./pkg/wire/...
```

### Integration & E2E (required)

```bash
# Prerequisites: make devenv sources=postgres_tests; enterprise overlay linked; make build-js

make test-go-integration-postgres SHARD=1 SHARDS=1
yarn e2e:playwright --grep @acceptance
```

## Rollback

Revert GE wire_gen and main; restore Step 06 stub initializers.

## LLM prompt seed

> Implement Step 08 per `docs/design/ge-standalone/step-08-ge-wire-generation.md`. Generate GE wire graph; swap stub ServerDeps in GE main for real gewire.Initialize. Keep OSS commands import — do not reimplement CLI. Update overlay copy scripts. Verify GE standalone and OSS overlay both run.
