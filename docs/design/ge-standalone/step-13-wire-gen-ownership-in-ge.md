# Step 13: Wire generation ownership in GE

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana-enterprise` (GE) + small OSS cleanup |
| **Depends on** | Steps 10, 12 |
| **Blocks** | Step 14 |
| **Behavior change** | OSS stops generating enterprise wire; overlay copies pre-generated files |

## Goal

Make Grafana Enterprise the **canonical owner** of enterprise Wire generation. OSS `make gen-go` only generates OSS `pkg/server/bootstrap/wire/wire_gen.go`. Enterprise `enterprise_wire_gen.go` is produced in GE `pkg/wire/wire_gen.go` and copied into OSS at dev/build time via existing scripts.

## Wire generation ownership (after this step)

| Artifact | Generated in | Consumed by |
|----------|--------------|-------------|
| OSS server graph | OSS `pkg/server/bootstrap/wire/wire_gen.go` | OSS CLI, overlay build |
| Enterprise server graph | GE `pkg/wire/wire_gen.go` | GE binary, copied → OSS `enterprise_wire_gen.go` |
| OSS edition bindings | OSS `pkg/server/wireext/` (source) | OSS injectors only |
| Enterprise edition bindings | GE `pkg/wireext/` (source) | GE injectors; copied → OSS `wireexts_enterprise.go` during transition |

## Scope

### In scope

**GE repo:**
- `make gen-wire` is the single source of truth for enterprise wire output (`./pkg/wire`).
- CI fails if `pkg/wire/wire_gen.go` is stale.
- `build.sh` and `enterprise-to-oss.sh` copy:
  - `pkg/wireext/enterprise.go` → OSS `pkg/server/wireexts_enterprise.go`
  - `pkg/wire/wire_gen.go` → OSS `pkg/server/enterprise_wire_gen.go`

**OSS repo:**
- Update `Makefile` `gen-enterprise-go` target:
  ```makefile
  gen-enterprise-go:
      @echo "Enterprise wire is generated in grafana-enterprise; run make gen-wire there and enterprise-to-oss.sh"
      @test -f pkg/server/enterprise_wire_gen.go || (echo "missing enterprise_wire_gen.go — sync from GE" && exit 1)
  ```
  Or remove `gen-enterprise-go` from default `gen-go` dependency and document sync workflow.
- Remove `wireinject` enterprise build from OSS wire tool invocation (no longer generate enterprise in OSS).
- Keep committed `enterprise_wire_gen.go` in OSS repo **during transition** for CI that doesn't clone GE — **or** require GE checkout in CI (Step 10 already does).

### Out of scope

- Deleting `wireexts_enterprise.go` from OSS tree (removed in Step 14).
- Removing overlay scripts entirely.

## Implementation tasks

1. **OSS Makefile change**
   - `gen-go` depends only on OSS wire generation (`./pkg/server/bootstrap/wire`).
   - Add `check-enterprise-wire` target verifying `enterprise_wire_gen.go` exists and matches GE output hash (optional).

2. **GE Makefile**
   ```makefile
   gen-wire:
       go run ./pkg/build/wire/cmd/wire/main.go gen -tags "enterprise" -gen_tags "(enterprise || pro)" ./pkg/wire
   sync-to-oss:
       ./enterprise-to-oss.sh -f
   ```

3. **Vendor wire tool** — copy `pkg/build/wire` from OSS into GE or use go.mod replace to OSS submodule path.

4. **Update developer docs**
   - After changing wire sets: run `make gen-wire` in GE, then `enterprise-to-oss.sh` or `make enterprise-dev`.

5. **Regenerate and commit** both files via GE-driven sync.

## Files likely touched

**OSS:**
- `Makefile`
- `pkg/server/enterprise_wire_gen.go` (updated via sync)
- `docs/design/ge-standalone/README.md`

**GE:**
- `Makefile`, `build.sh`, `enterprise-to-oss.sh`
- `pkg/wire/wire_gen.go`

## Acceptance criteria

- [ ] `make gen-go` in OSS does not invoke wire with enterprise tags.
- [ ] `make gen-wire` in GE produces complete enterprise graph.
- [ ] OSS overlay build after sync: `make build-backend`, `make run-go`, `make test-enterprise-go` pass.
- [ ] GE standalone: `make build`, server + apiserver commands work.
- [ ] Step 10 CI matrix passes.
- [ ] `make test-go-integration-postgres SHARD=1 SHARDS=1` passes.
- [ ] `yarn e2e:playwright --grep @acceptance` passes (enterprise overlay linked).

## Verification commands

```bash
# GE generates wire
cd ../grafana-enterprise
make gen-wire
./enterprise-to-oss.sh -f

# OSS uses synced files
cd ../grafana
make gen-go                    # OSS only
make build-backend
make run-go &
sleep 15 && curl -sf http://localhost:3000/api/health && kill %1
make test-enterprise-go

# GE standalone
cd ../grafana-enterprise
make build
./bin/grafana-enterprise server -homepath=../grafana &
sleep 20 && curl -sf http://localhost:3000/api/health && kill %1
```

### Integration & E2E (required)

```bash
# Prerequisites: make devenv sources=postgres_tests; enterprise overlay linked; make build-js

make test-go-integration-postgres SHARD=1 SHARDS=1
yarn e2e:playwright --grep @acceptance
```

## Rollback

Restore OSS `gen-enterprise-go` wire invocation; revert Makefile.

## LLM prompt seed

> Implement Step 13 per `docs/design/ge-standalone/step-13-wire-gen-ownership-in-ge.md`. Move enterprise wire generation to GE `make gen-wire` (output in `pkg/wire/wire_gen.go`); OSS `gen-go` generates only `pkg/server/bootstrap/wire/wire_gen.go`. Update sync scripts and Makefile. Verify dual-build CI and all tests pass.
