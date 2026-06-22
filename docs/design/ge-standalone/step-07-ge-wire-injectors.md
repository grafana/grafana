# Step 07: GE wire injectors

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana-enterprise` (GE) |
| **Depends on** | Steps 05, 06 |
| **Blocks** | Step 08 |
| **Behavior change** | None for OSS overlay (injectors not used until Step 08) |

## Goal

Move enterprise Wire **injector definitions** and **edition wire sets** from the overlaid `src/pkg/wire/server.go` into GE-owned packages, importing OSS `wiresets` instead of duplicating shared sets.

After this step, GE owns the canonical source of `wireExtsBasicSet` and related sets; overlay continues copying the output to OSS until Step 13.

## Scope

### In scope

- Create GE package structure:
  ```
  grafana-enterprise/
    pkg/wire/
      wire.go              // injectors: Initialize, InitializeModuleServer, etc.
      edition.go           // wireExtsBasicSet, wireExtsSet, wireExtsModuleServerSet, ...
      wireinject.go        // build tag: wireinject && enterprise
  ```
- Port content from `src/pkg/wire/server.go` (today's `wireexts_enterprise.go` source):
  - Change imports from `github.com/grafana/grafana/pkg/extensions/...` to `github.com/grafana/grafana-enterprise/pkg/...` **only if** enterprise packages have moved — see Import paths below.
  - Compose OSS shared sets: `wiresets.Server`, `wiresets.CLI`, etc.
- Copy enterprise implementation packages from `src/pkg/extensions/` → `pkg/` incrementally **or** keep `pkg/extensions/` path under GE module temporarily:
  - **Recommended for this step:** keep import paths as `github.com/grafana/grafana/pkg/extensions/...` inside GE wire files until Step 09 rename — minimizes diff size. GE module code can live under `src/pkg/extensions` with module path hack **or** use replace in overlay only.
  - **Cleaner approach:** move to `github.com/grafana/grafana-enterprise/pkg/...` in GE repo and update wire imports in same PR (large but one-time).

- Update `enterprise-to-oss.sh` source path if wire file location changes (GE repo only).

### Out of scope

- Running Wire generation successfully end-to-end (Step 08).
- OSS `pkg/server/wireexts_enterprise.go` deletion (still overlaid until Step 13).
- OSS `make gen-go` enterprise path changes.

## Import path strategy (choose one, document in PR)

| Strategy | PR size | Notes |
|----------|---------|-------|
| **A: Deferred rename** | Smaller | GE wire still references `pkg/extensions/...`; packages stay under `src/pkg/extensions` synced to OSS paths. Module `require` OSS only. Step 09 renames. |
| **B: Full rename now** | Larger | Move to `github.com/grafana/grafana-enterprise/pkg/...` in GE; update all internal imports. Overlay copies into OSS `pkg/extensions/` preserving OSS import paths via copy layout. |

Default recommendation for LLM: **Strategy A** for Step 07 unless human specifies B.

## Implementation tasks

1. **Create `pkg/wire/edition.go`** with all `wireExts*` sets from current `src/pkg/wire/server.go`.

2. **Create `pkg/wire/wire.go`** with injectors mirroring OSS:
   ```go
   //go:build wireinject && enterprise
   // +build wireinject,enterprise

   func Initialize(ctx context.Context, cfg *setting.Cfg, opts server.Options, apiOpts api.ServerOptions) (*server.Server, error) {
       wire.Build(wireExtsSet)
       return &server.Server{}, nil
   }
   ```
   Import `github.com/grafana/grafana/pkg/server` for return types.

3. **Wire tool setup**
   - Vendor or copy `pkg/build/wire/cmd/wire` from OSS, or use upstream `github.com/google/wire/cmd/wire` with GE's forked wire package if needed.
   - Document `make gen-wire` in GE Makefile invoking same flags as OSS:
     ```bash
     go run ./pkg/build/wire/cmd/wire/main.go gen -tags "enterprise" -gen_tags "(enterprise || pro)" ./pkg/wire
     ```

4. **Sync script update** (GE `enterprise-to-oss.sh`):
   - Copy GE `pkg/wire/edition.go` → OSS `pkg/server/wireexts_enterprise.go` (preserve overlay contract until Step 13).

5. **Do not delete** `src/pkg/wire/server.go` until Step 08 validates generation — mark deprecated or make it re-export from `pkg/wire/`.

## Files likely touched (GE repo)

- `pkg/wire/wire.go` (new)
- `pkg/wire/edition.go` (new)
- `src/pkg/wire/server.go` (deprecated / thin copy)
- `enterprise-to-oss.sh` (copy paths)
- `Makefile` (add `gen-wire` stub — generation in Step 08)

## Acceptance criteria

- [ ] GE `pkg/wire/*.go` compiles with `-tags=wireinject,enterprise` (injector files only).
- [ ] Content parity with previous `src/pkg/wire/server.go` (diff against overlay source).
- [ ] OSS overlay sync still produces valid `wireexts_enterprise.go`.
- [ ] OSS: `make gen-go` + `make build-backend` + enterprise tests pass **after** running overlay copy.
- [ ] `make test-go-integration-postgres SHARD=1 SHARDS=1` passes.
- [ ] `yarn e2e:playwright --grep @acceptance` passes (enterprise overlay linked).

## Verification commands

### GE repo

```bash
go build -tags=wireinject,enterprise ./pkg/wire/...
```

### OSS repo (after syncing wire file from GE)

```bash
make enterprise-dev   # or manual enterprise-to-oss.sh
make gen-go
make build-backend
make test-enterprise-go
make run-go &
sleep 15 && curl -sf http://localhost:3000/api/health && kill %1
```

### Integration & E2E (required)

```bash
# Prerequisites: make devenv sources=postgres_tests; enterprise overlay linked; make build-js

make test-go-integration-postgres SHARD=1 SHARDS=1
yarn e2e:playwright --grep @acceptance
```

## Rollback

Restore `src/pkg/wire/server.go` as canonical; remove `pkg/wire/`.

## LLM prompt seed

> Implement Step 07 in **grafana-enterprise** per `docs/design/ge-standalone/step-07-ge-wire-injectors.md`. Move enterprise wire sets and injectors to GE `pkg/wire/`, composing OSS `wiresets` from github.com/grafana/grafana. Update enterprise-to-oss.sh copy paths. Use deferred import path rename (Strategy A). Verify OSS overlay still builds after sync.
