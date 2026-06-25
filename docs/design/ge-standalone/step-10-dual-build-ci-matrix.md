# Step 10: Dual-build CI matrix

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana` (OSS) + `grafana/grafana-enterprise` (GE) |
| **Depends on** | Step 09 |
| **Blocks** | Step 13 |
| **Behavior change** | CI only; catches drift between overlay and standalone |

## Goal

Add CI jobs that enforce three build paths on every relevant PR:

1. **OSS-only** — no enterprise overlay
2. **OSS + overlay** — existing enterprise dev path
3. **GE standalone** — GE module builds without copying into OSS

## Scope

### In scope

**OSS CI additions:**
- Job `backend-oss`: `make gen-go && make build-backend && make test-go-unit` (default tags).
- Job `backend-enterprise-overlay`: script that runs `enterprise-to-oss.sh` (one-shot, no watcher), `make gen-go`, `make build-backend`, `make test-enterprise-go`.
- Document required secrets/checkouts for GE repo in CI (clone sibling).

**GE CI additions:**
- Job `build-standalone`: pin OSS module version to PR branch SHA when testing paired changes (use `go mod edit -replace` in CI).
- Job `gen-wire`: `make gen-wire` and fail if `wire_gen.go` dirty.

**Cross-repo (optional):**
- Trigger GE CI when OSS `pkg/server/bootstrap/wire`, `pkg/server/wireext`, or `bootstrap` changes (path filter).

### Out of scope

- Removing existing Drone pipelines.
- Retiring overlay (Step 14).

## Implementation tasks

1. **OSS workflow** `.github/workflows/backend-dual-build.yml` or Drone step:
   ```yaml
   # grafana/grafana-enterprise is a private repo — CI job needs org credentials
   - name: Enterprise overlay build
     run: |
       git clone --depth=1 https://github.com/grafana/grafana-enterprise ../grafana-enterprise
       cd ../grafana-enterprise && ./enterprise-to-oss.sh -f
       cd ../grafana
       make gen-go
       make build-backend
       make test-enterprise-go
   ```

2. **GE workflow** `.github/workflows/build.yml`:
   ```yaml
   - uses: actions/checkout@v4
     with:
       repository: grafana/grafana
       path: grafana
   - run: |
       cd grafana-enterprise
       go mod edit -replace github.com/grafana/grafana=../grafana
       make gen-wire
       git diff --exit-code pkg/wire/wire_gen.go
       make build
       go test ./...
   ```

3. **Document** in `docs/design/ge-standalone/README.md` CI section with links to workflows.

4. **Branch pairing** — document that paired OSS+GE PRs should use `go mod edit -replace` locally; CI uses same commit.

## Files likely touched

- `.github/workflows/*.yml` (OSS and/or GE)
- `.drone.yml` (if Drone is canonical — match existing CI pattern)
- `docs/design/ge-standalone/README.md`

## Acceptance criteria

- [ ] All three build paths green on main branch after merge.
- [ ] Intentional break in GE wire sets fails GE CI.
- [ ] Intentional break in OSS `pkg/server/bootstrap/wire` fails both OSS and GE CI.
- [ ] No change to local `make run` / `make build` developer experience.
- [ ] All three CI paths run integration tests (`make test-go-integration-postgres` or equivalent).
- [ ] All three CI paths run E2E acceptance smoke (`yarn e2e:playwright --grep @acceptance`).

## Verification commands (local simulation)

```bash
# Path 1: OSS-only
make gen-go && make build-backend && make test-go-unit SHARD=1 SHARDS=1

# Path 2: Overlay
cd ../grafana-enterprise && ./enterprise-to-oss.sh -f && cd ../grafana
make gen-go && make build-backend && make test-enterprise-go

# Path 3: GE standalone
cd ../grafana-enterprise
go mod edit -replace github.com/grafana/grafana=../grafana
make gen-wire && make build && go test ./...
```

### Integration & E2E (required)

```bash
make test-go-integration-postgres SHARD=1 SHARDS=1
yarn e2e:playwright --grep @acceptance
```

## Rollback

Disable new CI jobs; remove workflow files.

## LLM prompt seed

> Implement Step 10 per `docs/design/ge-standalone/step-10-dual-build-ci-matrix.md`. Add CI for OSS-only, OSS+overlay, and GE standalone builds. Follow existing Drone/GitHub Actions patterns in each repo. Document in ge-standalone README.
