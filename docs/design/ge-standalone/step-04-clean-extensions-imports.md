# Step 04: Clean extensions side-effect imports

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana` (OSS) |
| **Depends on** | Step 03 |
| **Blocks** | Step 05 |
| **Behavior change** | None intended |

## Goal

Consolidate how `pkg/extensions` side effects (primarily `extensions.IsEnterprise`) are loaded. Remove redundant blank imports while preserving enterprise overlay behavior when `ext.go` is present.

## Background

Today:
- `pkg/server/server.go` blank-imports `pkg/extensions`.
- Generated `wire_gen.go` may also blank-import `pkg/extensions`.
- `pkg/cmd/grafana-server/commands/buildinfo.go` sets `setting.IsEnterprise = extensions.IsEnterprise`.
- OSS stub: `pkg/extensions/main.go` sets `IsEnterprise = false`.
- Enterprise overlay: `pkg/extensions/ext.go` sets `IsEnterprise = true` in `init()`.

OSS must not import Grafana Enterprise, but the neutral `pkg/extensions` stub in OSS is acceptable.

## Scope

### In scope

- Remove `_ "github.com/grafana/grafana/pkg/extensions"` from `pkg/server/server.go` if redundant.
- Ensure `setting.IsEnterprise` is set exactly once during startup (in bootstrap build-info path).
- Regenerate Wire; confirm generated code does not reintroduce unnecessary blank imports.
- Document in `pkg/extensions/main.go` that this package is an OSS-owned hook point overlaid at dev/build time.

### Out of scope

- Deleting `pkg/extensions` stub.
- Removing enterprise overlay sync of `ext.go`.
- Changing enterprise feature gating logic.

## Implementation tasks

1. **Trace all `pkg/extensions` imports** in OSS (non-test, non-overlaid):
   ```bash
   rg 'pkg/extensions' pkg/ --glob '*.go' --glob '!pkg/extensions/**'
   ```

2. **Single load point**
   - Bootstrap `SetBuildInfo` (or equivalent) should import `github.com/grafana/grafana/pkg/extensions` and set `setting.IsEnterprise = extensions.IsEnterprise`.
   - Remove blank import from `server.go` if bootstrap/buildinfo already loads the package before server init.

3. **Wire regeneration**
   ```bash
   make gen-go
   ```
   - If `wire_gen.go` still blank-imports extensions, investigate which provider pulls it in; fix at source rather than editing generated file by hand.

4. **Verify enterprise detection**
   - OSS-only: `setting.IsEnterprise` must be `false` at runtime.
   - With overlay (`ext.go` present): must be `true`.

5. **Add a small test** in `bootstrap` or `setting`:
   - OSS build tags: `IsEnterprise` false after `SetBuildInfo`.
   - Enterprise build tags with overlay: test in `make test-enterprise-go` path if a suitable package exists.

## Files likely touched

- `pkg/server/server.go`
- `pkg/server/bootstrap/buildinfo.go`
- `pkg/extensions/main.go` (comment only)
- `pkg/server/wire_gen.go` (regenerated)
- `pkg/server/enterprise_wire_gen.go` (regenerated, if linked)

## Acceptance criteria

- [ ] OSS build: Grafana reports non-enterprise mode (check logs or `/api/health` payload if exposed).
- [ ] Enterprise overlay build: enterprise mode active; licensing endpoints behave as before.
- [ ] No duplicate `init()` side effects from multiple blank imports.
- [ ] All Step 03 verification commands still pass.
- [ ] `make test-go-integration-postgres SHARD=1 SHARDS=1` passes.
- [ ] `yarn e2e:playwright --grep @acceptance` passes (enterprise overlay linked).

## Verification commands

```bash
make gen-go
make lint-go
make build-backend

# OSS - confirm not enterprise (grep startup logs or API)
make run-go 2>&1 | head -50

go test -tags=oss -short ./pkg/server/bootstrap/...

# Enterprise overlay
make build-backend
make run-go 2>&1 | head -50
make test-enterprise-go
```

### Integration & E2E (required)

```bash
# Prerequisites: make devenv sources=postgres_tests; enterprise overlay linked; make build-js

make test-go-integration-postgres SHARD=1 SHARDS=1
yarn e2e:playwright --grep @acceptance
```

## Rollback

Restore blank import in `server.go`; revert bootstrap import consolidation.

## LLM prompt seed

> Implement Step 04 of `docs/design/ge-standalone/step-04-clean-extensions-imports.md`. Consolidate `pkg/extensions` loading to a single startup path in bootstrap. Remove redundant blank imports from server.go. Regenerate wire. Verify OSS IsEnterprise=false and enterprise overlay IsEnterprise=true.
