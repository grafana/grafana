# CI optimization: main vs PR

OSS [PR #129897](https://github.com/grafana/grafana/pull/129897) head `9898b6049da` · enterprise [PR #12912](https://github.com/grafana/grafana-enterprise/pull/12912) head `223febdd0`.

All figures measured 2026-08-12. Baselines are runs on other PRs against main, started within ~30 minutes of the PR runs unless noted. Durations are `started_at → completed_at`, i.e. **execution only — queue wait is excluded** (queue on these runs was 1s). Matrix figures are the mean of all shards, `n` given.

## grafana/grafana

PR runs: [backend unit](https://github.com/grafana/grafana/actions/runs/31632579511) · [integration](https://github.com/grafana/grafana/actions/runs/31632579568) · [frontend](https://github.com/grafana/grafana/actions/runs/31632579302) · [e2e](https://github.com/grafana/grafana/actions/runs/31632580082) · [go-lint](https://github.com/grafana/grafana/actions/runs/31632579477) · [workspace](https://github.com/grafana/grafana/actions/runs/31632579223) · [swagger](https://github.com/grafana/grafana/actions/runs/31632579295) · [govulncheck](https://github.com/grafana/grafana/actions/runs/31632579425) · [backend checks](https://github.com/grafana/grafana/actions/runs/31632579577)

| Change | Job | main | PR | Δ |
|---|---|---|---|---|
| S3 Go cache, backend unit | Grafana Enterprise shards | 432.2s (n=24) | **350.8s** (n=8) | **−81s/shard** |
| S3 Go cache, integration | Sqlite Enterprise | 445.1s (n=48) | **369.7s** (n=16) | **−75s/shard** |
| ” | MySQL Enterprise | 666.5s (n=48) | **566.4s** (n=16) | **−100s/shard** |
| ” | Postgres Enterprise | 645.5s (n=48) | **555.8s** (n=16) | **−90s/shard** |
| Go build cache | Go Workspace Check | 292.0s (n=2) | **190s** | **−102s** |
| ” | Check Wire Changes | 193.5s (n=2) | **116s** | **−78s** |
| ” | Verify committed API specs | 261.0s (n=3) | **189s** | **−72s** |
| ” | Validate Backend Configs | 662.0s (n=2) | **565s** | **−97s** |
| ” | govulncheck | 222.0s (n=4) | 206s | −16s |
| ” | go-fmt (flag kept off) | 146.0s (n=2) | 133s | −13s |
| ” | lint-go | 310.5s (n=2) | 301s | −10s (noise) |
| Cache golden files | gate job, cache **hit** | 273s ([job](https://github.com/grafana/grafana/actions/runs/31633613475/job/94238631279)) | **22s** ([job](https://github.com/grafana/grafana/actions/runs/31632579302/job/94244109494)) | **−251s** |
| Cache Playwright browsers | Playwright E2E shards | 336.5s (n=40) | 315.5s (n=8) | −21s/shard |
| Chromium/check-cache (n/a OSS) | frontend unit shards | 217.2s (n=32) | 217.1s (n=16) | flat |
| Right-size detect-changes runner | detect-changes, frontend workflow | 29.5s (n=4) | 35s | **+5.5s** |
| Local check-jobs action | — | — | — | correctness; adds one checkout |
| Shard script single-pass | — | — | — | output byte-identical to old script |
| Remove dead steps, retries, pins, gates | — | — | — | no timing effect by design |

Baseline runs used: [31633613397](https://github.com/grafana/grafana/actions/runs/31633613397), [31632763662](https://github.com/grafana/grafana/actions/runs/31632763662), [31632763656](https://github.com/grafana/grafana/actions/runs/31632763656), [31632625071](https://github.com/grafana/grafana/actions/runs/31632625071), [31634191052](https://github.com/grafana/grafana/actions/runs/31634191052), [31633613475](https://github.com/grafana/grafana/actions/runs/31633613475), [31634191084](https://github.com/grafana/grafana/actions/runs/31634191084), [31634191113](https://github.com/grafana/grafana/actions/runs/31634191113), [31634191116](https://github.com/grafana/grafana/actions/runs/31634191116), [31633613422](https://github.com/grafana/grafana/actions/runs/31633613422), [31633613816](https://github.com/grafana/grafana/actions/runs/31633613816).

**Not measurable on this head.** `PR build Docker image` and `Test Dockerfile` are path-gated and were skipped, so the docker-dedup, QEMU-skip, sourcemap and catalog-download commits have **no current data**. They need a run that touches a `Dockerfile`/`Makefile` path plus a frontend path.

## grafana/grafana-enterprise

PR runs: [integration](https://github.com/grafana/grafana-enterprise/actions/runs/31632585368) · [unit](https://github.com/grafana/grafana-enterprise/actions/runs/31632585478) · [frontend](https://github.com/grafana/grafana-enterprise/actions/runs/31632585267) · [e2e](https://github.com/grafana/grafana-enterprise/actions/runs/31632585409) · [codegen](https://github.com/grafana/grafana-enterprise/actions/runs/31632585380)

| Change | Job | main | PR | Δ |
|---|---|---|---|---|
| **Shallow branch fetch** | `Set up Grafana Enterprise` step, every job | **309.2s** (n=336) | **8.9s** (n=102) | **−300s/job** |
| Drop chromium + `--check-cache` | frontend unit shards | 353.4s (n=32) | **278.4s** (n=15) | **−75s/shard** |
| ” | the two removed steps alone | 57s + 97s ([job](https://github.com/grafana/grafana-enterprise/actions/runs/31634580011/job/94242564637)) | absent / 70s | **−84s** |
| Cache golden files | gate job, cache **hit** | 197.0s (n=2) | **23s** ([job](https://github.com/grafana/grafana-enterprise/actions/runs/31632585267/job/94244113504)) | **−174s** |
| Share Go cache tooling | unit shards (enterprise) | 755.6s (n=16) | **603.0s** (n=8) | **−153s/shard** |
| ” | unit shards (pro) | 765.2s (n=16) | **606.6s** (n=8) | **−159s/shard** |
| ” | race unit tests | 390.0s (n=4) | 393.0s (n=2) | flat |
| Gate ungated workflows | Verify generated CUE code | 168.5s (n=2) | **89s** | −80s |
| ” | Verify Swagger/OpenAPI | 237.0s (n=2) | **190s** | −47s |
| Integration S3 cache **reverted** | SQLite integration vs clean baseline | 191.1s (n=16) | 198.8s (n=16) | flat — parity restored |
| e2e server composite | Enterprise E2E | — | 324s | dedup only, −203 lines |
| lint-backend | lint-backend | 323s | 324s | flat |

Baseline runs used: [31627267306](https://github.com/grafana/grafana-enterprise/actions/runs/31627267306), [31617712994](https://github.com/grafana/grafana-enterprise/actions/runs/31617712994), [31614788025](https://github.com/grafana/grafana-enterprise/actions/runs/31614788025), [31610828119](https://github.com/grafana/grafana-enterprise/actions/runs/31610828119), [31628850149](https://github.com/grafana/grafana-enterprise/actions/runs/31628850149), [31628850290](https://github.com/grafana/grafana-enterprise/actions/runs/31628850290), [31634580011](https://github.com/grafana/grafana-enterprise/actions/runs/31634580011).

### The shallow fetch is the largest single win, and it was previously understated

`Set up Grafana Enterprise` fetches the paired OSS branch. On main that fetch has no depth cap. Across four recent baseline integration runs (84 jobs each):

| Baseline run | mean step | SQLite job mean |
|---|---|---|
| [31610828119](https://github.com/grafana/grafana-enterprise/actions/runs/31610828119) | 488.4s | 819s |
| [31627267306](https://github.com/grafana/grafana-enterprise/actions/runs/31627267306) | 367.4s | 684s |
| [31614788025](https://github.com/grafana/grafana-enterprise/actions/runs/31614788025) | 374.2s | 490s |
| [31617712994](https://github.com/grafana/grafana-enterprise/actions/runs/31617712994) | 6.9s | 191s |
| **PR** | **8.9s** | **198.8s** |

Three of four recent main runs are affected, worst case **1677s in that one step** ([job](https://github.com/grafana/grafana-enterprise/actions/runs/31614788025/job/94174835808)). Step breakdown of one degraded baseline shard: `Set up Grafana Enterprise` 1390s against a 186s test step ([job](https://github.com/grafana/grafana-enterprise/actions/runs/31627267306/job/94216842427)). Queue time on these jobs is 1s, so this is execution, not scheduling.

The PR caps that fetch at depth 1 and never exceeds 46s across 102 jobs.

## Caveats

- **Integration parity, not a win.** The enterprise integration jobs were reverted off the S3 build cache after it measured +31 runner-minutes per run (Remote Alert Manager 82s → 277s). They are now flat against the clean baseline, which is the intended result. Against a *typical* (fetch-degraded) main run they look 300–600s faster per shard, but that credit belongs to the shallow fetch.
- **Golden-files numbers are from a rerun.** The first run on this head missed by design — the key gained `pkg/apimachinery/**` to stop it serving stale goldens. Attempt 2 hit: 22s (OSS) and 23s (enterprise).
- **Cache hits do not cross PRs.** The entry is scoped to `refs/pull/129897/merge`, so other PRs only benefit once this merges and main populates a shared entry.
- **`lint-go` and `go-fmt` are within noise** (n=1 PR sample vs n=2 baseline). The Go build cache claim rests on the four jobs with 72–102s deltas.
- **detect-changes is 5.5s slower** on arm64-small. Kept for cost, not speed.
- **Enterprise unit shards**: setup is identical to main (remote cache 10s, Setup Go 7s); the −153s comes from `Run unit tests`. n=8 vs 16.

## Open failures

| Failure | Cause |
|---|---|
| OSS `Documentation`, OSS + enterprise `Lint Frontend` | Prettier rejects this report file. Disregarded; goes away when it is deleted |
| enterprise `Unit test frontend` shard 6/16 | `HomeRoute › homeDashboardUID absent` — 1 of 1748 tests. Branch touches no app source, the shard passed on the previous head, and OSS `Frontend tests` passes the same test on this head. Likely a flake, unproven |
