# Step 12: OSS remove apiserver CLI hook

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana` (OSS) |
| **Depends on** | Steps 09, 11 |
| **Blocks** | Step 13 |
| **Behavior change** | OSS `grafana` binary no longer exposes `apiserver` subcommand |

## Goal

Remove enterprise-specific CLI registration from OSS `main.go`. Enterprise users use `grafana-enterprise apiserver` or the full GE binary. OSS `InitializeAPIServerFactory` remains in OSS wire graph as **noop** for wire compatibility until Step 13 cleans up further.

## Prerequisites

- [ ] Step 11 merged; GE binary provides `apiserver`.
- [ ] Step 10 CI green for GE standalone.
- [ ] Team agreement on developer messaging (update enterprise README/dev docs).

## Scope

### In scope

- Remove from `pkg/cmd/grafana/main.go`:
  ```go
  f, err := server.InitializeAPIServerFactory()
  // ... append apiserver command
  ```
- Update OSS docs / `contribute/developer-guide.md` or enterprise README (via GE repo) to point to `grafana-enterprise apiserver`.
- Update mt-tilt k8s manifests in OSS (synced from GE) **only if** this step includes devenv doc update — prefer GE repo change copied by overlay.

### Out of scope

- Removing `wireExtsStandaloneAPIServerSet` from overlaid `wireexts_enterprise.go` (Step 13).
- Removing `InitializeAPIServerFactory` from OSS `wire.go` (optional cleanup in Step 13).

## Implementation tasks

1. **Edit `pkg/cmd/grafana/main.go`** — delete apiserver registration block.

2. **Verify OSS noop path**
   - OSS build: `./bin/grafana apiserver` should fail with "command not found" / not found message.

3. **Verify enterprise overlay**
   - Overlay still builds combined binary from OSS — **after this step**, enterprise monolith from OSS **loses** apiserver unless developers use GE binary.
   - **Migration note:** document dual binary dev workflow until Step 14:
     ```bash
     make enterprise-dev
     make build-backend              # OSS-path monolith without apiserver
     cd ../grafana-enterprise && make build
     ./bin/grafana-enterprise apiserver ...
     ```

4. **Update tests** if any integration test invoked `./bin/grafana apiserver` from OSS build — switch to GE binary or skip with build tag.

## Files likely touched

- `pkg/cmd/grafana/main.go`
- Docs (OSS or GE README via overlay)
- Possibly e2e or devenv scripts referencing apiserver command

## Acceptance criteria

- [ ] OSS-only build: no `apiserver` command.
- [ ] OSS overlay build: no `apiserver` on OSS binary; GE binary has it.
- [ ] `make build-backend`, `make run-go`, `make test-go-unit` pass (OSS).
- [ ] `make test-enterprise-go` pass.
- [ ] Step 10 CI matrix passes.
- [ ] `make test-go-integration-postgres SHARD=1 SHARDS=1` passes.
- [ ] `yarn e2e:playwright --grep @acceptance` passes (enterprise overlay linked).

## Verification commands

```bash
# OSS-only
make build-backend
./bin/grafana apiserver 2>&1 | grep -i "not.*command" || test $? -ne 0

# GE has apiserver
cd ../grafana-enterprise && make build
./bin/grafana-enterprise apiserver --help

# Overlay server still runs
cd ../grafana
make enterprise-dev
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

Restore apiserver block in OSS main.go.

## LLM prompt seed

> Implement Step 12 per `docs/design/ge-standalone/step-12-oss-remove-apiserver-hook.md`. Remove InitializeAPIServerFactory registration from OSS pkg/cmd/grafana/main.go. Update docs. Verify GE binary has apiserver; OSS binary does not. All tests and make run-go still pass with overlay.
