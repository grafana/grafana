# Step 06: GE module scaffold + health binary

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana-enterprise` (GE) |
| **Depends on** | Step 05 (OSS bootstrap API published on branch GE can pin) |
| **Blocks** | Step 07 |
| **Behavior change** | None for OSS overlay builds |

## Goal

Add a root Go module to Grafana Enterprise and a minimal binary that proves GE can compile against OSS as a module dependency. The binary only serves `/healthz` — no Wire, no full server.

## Scope

### In scope

- Create `go.mod` at GE repo root:
  ```go
  module github.com/grafana/grafana-enterprise

  go 1.26.4

  require github.com/grafana/grafana vX.Y.Z // pin to OSS release or pseudo-version from branch
  ```
- Create `cmd/grafana-enterprise/main.go`:
  - HTTP server on configurable port (default `:3000` or `:3001` to avoid clashing with OSS dev).
  - `GET /healthz` → `200 OK` with body `ok`.
  - Optional: `-version` flag printing GE + OSS module version from `runtime/debug.ReadBuildInfo`.
- Add `Makefile` targets:
  - `make build` → builds `bin/grafana-enterprise`
  - `make test` → `go test ./...`
- Add `README` section in GE repo linking to this step.
- **Optional local dev:** document `go.work` pairing with sibling OSS checkout (do not commit `go.work` to GE unless team agrees).

### Out of scope

- Wire injectors or enterprise services.
- Changes to OSS overlay scripts (must still work unchanged).
- Replacing OSS `make run` workflow.
- Frontend.

## Implementation tasks

1. **Choose OSS dependency pin**
   - For development: `replace github.com/grafana/grafana => ../grafana` in `go.mod` (local only) or use `go.work`.
   - For CI: pin to OSS commit SHA via pseudo-version after Step 05 merges.

2. **Implement health binary** (~50 lines).

3. **GE CI job** (Drone/GitHub Actions in GE repo):
   ```bash
   go build -o bin/grafana-enterprise ./cmd/grafana-enterprise
   go test ./...
   ```
   - Job must not require overlay or OSS checkout beyond module fetch (except when using `replace` for dev branches).

4. **Verify OSS unaffected**
   - No changes required in OSS repo for this step except optionally documenting the pin in `docs/design/ge-standalone/`.

## Files likely touched (GE repo)

- `go.mod` (new)
- `go.sum` (new)
- `cmd/grafana-enterprise/main.go` (new)
- `Makefile` (new or extend root Makefile)
- `.github/workflows/` or `.drone.yml` (new job)

## Acceptance criteria

- [ ] `go build ./cmd/grafana-enterprise` succeeds in GE repo.
- [ ] Binary runs; `curl localhost:3001/healthz` returns 200.
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
./bin/grafana-enterprise -port=3001 &
sleep 2 && curl -sf http://localhost:3001/healthz && kill %1
go test ./...
```

### OSS repo (regression)

```bash
cd ../grafana
make gen-go
make build-backend
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

> Implement Step 06 of grafana OSS repo `docs/design/ge-standalone/step-06-ge-module-scaffold.md` in the **grafana-enterprise** repository. Add root go.mod, health-check binary at cmd/grafana-enterprise, Makefile, and CI. Pin github.com/grafana/grafana. Do not modify OSS overlay. Verify GE builds independently and OSS make run-go still works.
