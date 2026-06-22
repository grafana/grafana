# Step 14: Retire overlay

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana-enterprise` (GE) + `grafana/grafana` (OSS) |
| **Depends on** | Step 13 |
| **Blocks** | — (final step) |
| **Behavior change** | **Major** — developers no longer use `make enterprise-dev` |

## Goal

End the dual-repo file overlay. Grafana Enterprise builds and releases from its own module; OSS builds OSS-only. Documentation, CI, and release pipelines reflect the new model.

## Prerequisites

- [ ] GE standalone binary passes full test matrix (unit, integration, enterprise tests, acceptance e2e).
- [ ] Step 10 CI green for 2+ weeks on main.
- [ ] Release engineering sign-off for artifact changes.
- [ ] Frontend strategy agreed (npm package, embedded in GE build, or continued copy — document chosen path).

## Scope

### In scope

**Stop using overlay:**
- Deprecate `make enterprise-dev`, `enterprise-to-oss.sh`, `oss-to-enterprise.sh` (remove or print deprecation stub).
- Remove OSS `.gitignore` entries for `pkg/extensions/*` except neutral stub files.
- Delete overlaid paths from OSS repo history going forward (keep stub `pkg/extensions/main.go` with `IsEnterprise = false`).

**OSS cleanup:**
- Remove `pkg/server/wireexts_enterprise.go` and `enterprise_wire_gen.go` from OSS.
- Remove `gen-enterprise-go`, `test-enterprise-go` from OSS Makefile (or redirect to "clone GE").
- Remove `local/Makefile` symlink install from GE `install.sh` or repurpose for GE-only targets.
- Remove `InitializeAPIServerFactory` and enterprise wire injectors from OSS `wire.go` if still present.
- Clean OSS references to overlaid paths in CI.

**GE ownership:**
- Release pipeline produces `grafana-enterprise` binary and Docker images.
- OSS `build.sh` integration removed from OSS CI; GE CI runs `build.sh` equivalent.
- Import paths: complete migration to `github.com/grafana/grafana-enterprise/pkg/...` (if deferred from Step 07).
- Frontend: document/build step for enterprise UI assets in GE release.

**Documentation:**
- Update GE README dual-repo section → module import model.
- Update OSS developer guide: enterprise features require GE repo.
- Archive design docs with "completed" status.

### Out of scope

- Rewriting enterprise features.
- Open-sourcing enterprise code.

## Implementation tasks

### Phase 14a — Soft deprecation (PR 1)

1. Add deprecation warnings to `start-dev.sh`, `enterprise-to-oss.sh`.
2. Publish migration guide in GE README.
3. No workflow change yet.
4. Verify: integration + `yarn e2e:playwright --grep @acceptance` still pass.

### Phase 14b — CI cutover (PR 2)

1. OSS CI removes enterprise overlay jobs; adds check that OSS tree has no enterprise files committed.
2. GE CI becomes required check for enterprise releases.
3. Verify:
   ```bash
   make build && make test-go-unit
   make test-go-integration-postgres SHARD=1 SHARDS=1
   yarn e2e:playwright --grep @acceptance
   ```

### Phase 14c — File removal (PR 3)

1. Remove overlay scripts and OSS enterprise wire files.
2. Remove `pkg/extensions` overlay gitignore; keep stub only.
3. Remove `public/app/extensions` from OSS (enterprise FE built from GE).

### Phase 14d — Release cutover (PR 4)

1. Switch Docker/release pipelines to GE binary.
2. Update devenv/mt-tilt to GE images only.
3. Run full E2E suite against GE release candidate:
   ```bash
   yarn e2e:playwright
   ```

## Acceptance criteria

Each phase (14a–14d) must pass integration and E2E acceptance smoke before merge. Phase 14d additionally requires the **full** E2E suite (not just `@acceptance`).

- [ ] Fresh OSS clone: `make run-go` works without GE checkout.
- [ ] Fresh GE clone + OSS module pin: `make build && ./bin/grafana-enterprise server` works.
- [ ] No `make enterprise-dev` in active developer docs.
- [ ] `make test-go-unit`, `make test-go-integration-postgres` pass on OSS.
- [ ] GE: full enterprise test suite + `yarn e2e:playwright --grep @acceptance` pass.
- [ ] No OSS source file imports `github.com/grafana/grafana-enterprise` (N/A — OSS never should).
- [ ] No committed enterprise code under OSS `pkg/extensions/` except stub.

## Verification commands

### OSS-only world

```bash
git clone grafana/grafana && cd grafana
make gen-go
make build
make run-go &
sleep 15 && curl -sf http://localhost:3000/api/health && kill %1
make test-go-unit SHARD=1 SHARDS=1
make test-go-integration-postgres
```

### GE world

```bash
git clone grafana/grafana-enterprise && cd grafana-enterprise
go mod download
make gen-wire
make build
./bin/grafana-enterprise server -homepath=$GRAFANA_HOME &
sleep 20 && curl -sf http://localhost:3000/api/health && kill %1
go test ./...
# Enterprise e2e from GE or OSS checkout with GE binary
yarn e2e:playwright --grep @acceptance
```

## Rollback plan

Keep overlay scripts on a git tag `overlay-final` for emergency revert. Document one-command restore procedure for release engineering.

## LLM prompt seed

> Implement Step 14 phase 14a (soft deprecation) per `docs/design/ge-standalone/step-14-retire-overlay.md`. Do not remove overlay yet — add deprecation warnings and migration guide only. Verify all existing workflows still work.

> **Note:** Steps 14b–14d should be separate PRs with explicit human approval between each phase.

## Human gates

| Phase | Approver | Risk |
|-------|----------|------|
| 14a | Engineering lead | Low |
| 14b | CI/release | Medium |
| 14c | Enterprise squad | High |
| 14d | Release engineering | Critical |

Do not combine 14c and 14d in a single LLM-driven PR.
