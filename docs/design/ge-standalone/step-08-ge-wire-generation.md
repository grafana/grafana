# Step 08: GE wire generation + first server build

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana-enterprise` (GE) |
| **Depends on** | Step 07 |
| **Blocks** | Steps 09, 11 |
| **Behavior change** | Adds GE-built server binary; OSS overlay path must remain working |

## Goal

Run Wire generation in the GE repo, produce `pkg/wire/wire_gen.go`, and build a GE binary that starts the **full enterprise Grafana server** via `bootstrap.RunServer` and GE's `Initialize`.

## Scope

### In scope

- Implement `make gen-wire` in GE that generates `pkg/wire/wire_gen.go`.
- Wire GE injectors to completion — resolve all provider errors until generation succeeds.
- Create `cmd/grafana-enterprise/main.go` (replace health-only stub from Step 06) **or** add `cmd/grafana-enterprise/server/main.go`:
  ```go
  func main() {
      app := &cli.App{
          Commands: []*cli.Command{{
              Name: "server",
              Action: func(c *cli.Context) error {
                  return bootstrap.RunServer(c.Context, bootstrap.RunServerConfig{
                      // ...
                      Init: wire.Initialize, // GE injector
                  })
              },
          }},
      }
      app.Run(os.Args)
  }
  ```
- Extend `bootstrap` if needed to accept an injector function (minimal OSS change — **small OSS PR allowed** in this step only):
  ```go
  type ServerInitializer func(context.Context, *setting.Cfg, server.Options, api.ServerOptions) (*server.Server, error)
  ```
  OSS default CLI continues passing `server.Initialize` (OSS injector).

- Copy generated `wire_gen.go` to OSS via overlay script as `enterprise_wire_gen.go` until Step 13.

### Out of scope

- Full CLI parity (grafana-cli subcommands, apiserver — Steps 09, 11).
- Removing OSS enterprise wire generation (still runs in parallel for safety).
- Frontend assets in GE binary.

## OSS touch (minimal, same or paired PR)

If `bootstrap.RunServer` hardcodes `server.Initialize`, add optional `ServerInitializer` field to `RunServerConfig` defaulting to `server.Initialize` for backward compatibility.

**Verification required on OSS PR:** all Step 05 checks pass.

## Implementation tasks

1. **Wire generation loop**
   ```bash
   cd grafana-enterprise
   make gen-wire
   ```
   Fix missing providers by importing additional OSS wire sets or adding GE providers — mirror what `wireexts_enterprise.go` does today.

2. **Bootstrap injector hook (OSS)**
   - File: `pkg/server/bootstrap/bootstrap.go`
   - Add `Initialize ServerInitializer` field; default `server.Initialize`.

3. **GE main**
   - Import `github.com/grafana/grafana/pkg/server/bootstrap`
   - Import GE `pkg/wire` generated `Initialize`
   - Reuse CLI flags from OSS or embed minimal subset (config, homepath, pidfile).

4. **Update overlay**
   - `enterprise-to-oss.sh`: copy `pkg/wire/wire_gen.go` → `$GRAFANA_DIR/pkg/server/enterprise_wire_gen.go`
   - `enterprise-to-oss.sh`: copy edition injectors → `wireexts_enterprise.go`

5. **Binary smoke test**
   ```bash
   go build -tags=enterprise -o bin/grafana-enterprise ./cmd/grafana-enterprise
   ./bin/grafana-enterprise server -homepath=/path/to/oss/grafana
   curl http://localhost:3000/api/health
   ```

## Files likely touched

**GE:**
- `pkg/wire/wire_gen.go` (generated)
- `cmd/grafana-enterprise/main.go`
- `Makefile`
- `enterprise-to-oss.sh`, `build.sh`

**OSS (optional small PR):**
- `pkg/server/bootstrap/bootstrap.go`

## Acceptance criteria

- [ ] GE `make gen-wire` succeeds; `wire_gen.go` committed.
- [ ] GE enterprise binary starts full server with enterprise features (license check, enterprise routes).
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
go test -tags=oss -short ./pkg/server/bootstrap/...

# GE
go test -tags=enterprise -short ./pkg/wire/...
```

### Integration & E2E (required)

# Prerequisites: make devenv sources=postgres_tests; enterprise overlay linked; make build-js

make test-go-integration-postgres SHARD=1 SHARDS=1
yarn e2e:playwright --grep @acceptance
```

## Rollback

Revert GE wire_gen and main; restore Step 06 health-only binary. Restore bootstrap if injector hook added.

## LLM prompt seed

> Implement Step 08 per `docs/design/ge-standalone/step-08-ge-wire-generation.md`. Generate GE wire graph, build enterprise server binary via bootstrap.RunServer with GE Initialize. Add optional ServerInitializer to OSS bootstrap if needed (minimal OSS PR). Update overlay copy scripts. Verify GE standalone and OSS overlay both run.
