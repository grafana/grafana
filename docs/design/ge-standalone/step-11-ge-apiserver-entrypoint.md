# Step 11: GE apiserver entrypoint

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana-enterprise` (GE) |
| **Depends on** | Step 08 |
| **Blocks** | Step 12 |
| **Behavior change** | GE binary gains `apiserver` command; OSS hook remains until Step 12 |

## Goal

Expose `grafana-enterprise apiserver` using the enterprise APIServer factory (`extensions/apiserver` / GE `pkg/apiserver`), without relying on OSS `main.go` calling `InitializeAPIServerFactory`.

## Scope

### In scope

- Add GE wire injector for standalone apiserver factory (mirrors OSS `InitializeAPIServerFactory` + `wireExtsStandaloneAPIServerSet`):
  ```go
  func InitializeAPIServerFactory() (standalone.APIServerFactory, error) {
      wire.Build(wireExtsStandaloneAPIServerSet)
      return &standalone.NoOpAPIServerFactory{}, nil
  }
  ```
- Register CLI command in GE `main.go` (same pattern as OSS `pkg/cmd/grafana/main.go` today).
- Reuse existing cobra-based implementation in `pkg/extensions/apiserver/cli.go` (or GE `pkg/apiserver/cli.go` after rename).
- mt-tilt / Docker: document optional switch to GE binary for apiserver pods (config-only change in GE devenv — optional sub-PR).

### Out of scope

- Removing OSS apiserver hook (Step 12).
- Rewriting apiserver factory internals.

## Implementation tasks

1. **Port `wireExtsStandaloneAPIServerSet`** to GE `pkg/wire/edition.go`:
   ```go
   var wireExtsStandaloneAPIServerSet = wire.NewSet(
       extapiserver.ProvideAPIFactory,
   )
   ```

2. **Generate wire** for apiserver factory injector; include in `make gen-wire`.

3. **GE main.go** — append apiserver command:
   ```go
   f, err := wire.InitializeAPIServerFactory()
   if err == nil && f.GetCLICommand(buildInfo) != nil {
       app.Commands = append(app.Commands, f.GetCLICommand(buildInfo))
   }
   ```

4. **Smoke test**
   ```bash
   ./bin/grafana-enterprise apiserver --help
   ./bin/grafana-enterprise apiserver --runtime-config=... # dry run or known dev config
   ```

5. **Regression:** OSS overlay binary still exposes `grafana apiserver` until Step 12.

## Files likely touched (GE)

- `pkg/wire/wire.go`, `edition.go`, `wire_gen.go`
- `cmd/grafana-enterprise/main.go`
- `pkg/apiserver/cli.go` (if moved from extensions path)

## Acceptance criteria

- [ ] `grafana-enterprise apiserver --help` works.
- [ ] Apiserver starts in dev config (document minimal flags / homepath).
- [ ] OSS overlay: `./bin/grafana apiserver --help` still works (unchanged this step).
- [ ] `make test-enterprise-go` includes apiserver packages if present.
- [ ] `make test-go-integration-postgres SHARD=1 SHARDS=1` passes.
- [ ] `yarn e2e:playwright --grep @acceptance` passes (enterprise overlay linked).

## Verification commands

```bash
# GE
cd ../grafana-enterprise
make gen-wire && make build
./bin/grafana-enterprise apiserver --help

# OSS overlay regression
cd ../grafana
make enterprise-dev
make build-backend
./bin/grafana apiserver --help
make test-enterprise-go
```

### Integration & E2E (required)

```bash
# Prerequisites: make devenv sources=postgres_tests; enterprise overlay linked; make build-js

make test-go-integration-postgres SHARD=1 SHARDS=1
yarn e2e:playwright --grep @acceptance
```

## Rollback

Remove apiserver command from GE main; revert wire injector.

## LLM prompt seed

> Implement Step 11 per `docs/design/ge-standalone/step-11-ge-apiserver-entrypoint.md` in grafana-enterprise. Add apiserver CLI via GE wire InitializeAPIServerFactory. Do not remove OSS hook yet. Verify GE and OSS overlay apiserver help both work.
