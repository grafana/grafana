# CI optimization verification report

Branches: `ci-runner-optimizations` in grafana/grafana ([PR #129897](https://github.com/grafana/grafana/pull/129897), head `146288aaa40`) and grafana/grafana-enterprise ([PR #12912](https://github.com/grafana/grafana-enterprise/pull/12912), head `15b728d31` at verification time).

## Method and limits — read first

- Every numeric claim below links to the exact run or job it was measured from, on both sides of the comparison. Job durations are `startedAt → completedAt` from the GitHub API; step durations from log timestamps.
- Most comparisons are **single run pairs**. One pair is not a benchmark; treat deltas as indicative.
- Both branches carry an evaluation-only commit touching every trigger group, so these runs execute more workflows than a typical PR, and the simultaneous start caused runner queueing. Workflow wall-clocks are queue-confounded; job/step durations are the trustworthy signal.
- Verdicts: **Verified** = mechanism observed in logs and effect measured with linked evidence. **Mechanism only** = change demonstrably active, no speed/compute win provable from the data. **Unproven** = not observable on these branches. **Regression** = made something worse (two found; fixes applied, unvalidated).

## grafana/grafana (PR #129897)

### Verified with measurements

**Docker build chain deduplication — 68.4 → 39.6 runner-minutes (one PR pair).**
Branch: [PR build Docker image run](https://github.com/grafana/grafana/actions/runs/30669482661) (13 jobs, 29m38s summed) + [Test Dockerfile run](https://github.com/grafana/grafana/actions/runs/30669482580) (1 job, [9m57s](https://github.com/grafana/grafana/actions/runs/30669482580/job/91283899557)) = 39.6 runner-min.
Baseline (PR #129896): [PR build run](https://github.com/grafana/grafana/actions/runs/30666234919) (23m50s) + [Test Dockerfile run](https://github.com/grafana/grafana/actions/runs/30666235209) (10 jobs, 44m33s) = 68.4 runner-min.
Branch runs contain no duplicate frontend/backend builds; all six variants still build ([job list](https://github.com/grafana/grafana/actions/runs/30669482661)). Note: the remaining full-source Docker job is ~10m and unchanged by design.

**Golden-files cache — 4m42s → 17s for the job gating all unit-test shards.**
Branch: [Generate golden files, 17s](https://github.com/grafana/grafana/actions/runs/30669482628/job/91283979301), log `Cache hit for: golden-files-Linux-88a1906e...`, Setup Go and generation skipped.
Baseline (PR #129896): [same job, 4m42s](https://github.com/grafana/grafana/actions/runs/30666234805/job/91273917034).
The cache-miss path (a change under `apps/dashboard`) was not exercised — unproven.

**Frontend tests wall-clock — 12m02s → 8m29s (vs same-day main).**
Branch: [run, 8m29s](https://github.com/grafana/grafana/actions/runs/30669482628). Main, same day: [run, 12m02s](https://github.com/grafana/grafana/actions/runs/30669169912). This is the only wall-clock claim made for the OSS repo; it follows directly from the golden-files gate collapsing.

**Sourcemap skip in PR frontend build — 5m58s → 4m01s (one pair).**
Branch: [build frontend, 4m01s](https://github.com/grafana/grafana/actions/runs/30669482661/job/91284016449), step env shows `NO_SOURCEMAP: 1`.
Baseline (PR #129896): [build frontend, 5m58s](https://github.com/grafana/grafana/actions/runs/30666234919/job/91274705992).

**Go build cache on compile-heavy jobs — all six jobs faster than a same-evening PR baseline where the same jobs ran.**
Branch (lint-go log shows `Cache restored from key: setup-go-Linux-x64-...`):
| Job | Branch | Baseline (PR `fix-azure-monitor-trace-exemplar-portal-links`) |
|---|---|---|
| lint-go | [5m16s](https://github.com/grafana/grafana/actions/runs/30669482632/job/91283990910) | [5m49s](https://github.com/grafana/grafana/actions/runs/30668635725/job/91281446195) |
| Validate Backend Configs | [9m27s](https://github.com/grafana/grafana/actions/runs/30669482498/job/91283995181) | [11m13s](https://github.com/grafana/grafana/actions/runs/30668635708/job/91281447804) |
| Swagger verify | [3m43s](https://github.com/grafana/grafana/actions/runs/30669482503/job/91283982378) | [4m19s](https://github.com/grafana/grafana/actions/runs/30668635761/job/91281447917) |
| Check Wire Changes | [2m30s](https://github.com/grafana/grafana/actions/runs/30669482563/job/91284116086) | [3m20s](https://github.com/grafana/grafana/actions/runs/30668635692/job/91281571304) |
| Go Workspace Check | [3m14s](https://github.com/grafana/grafana/actions/runs/30669482563/job/91284116082) | [4m07s](https://github.com/grafana/grafana/actions/runs/30668635692/job/91281571294) |
| govulncheck | [2m43s](https://github.com/grafana/grafana/actions/runs/30669482529/job/91283899306) | [3m27s](https://github.com/grafana/grafana/actions/runs/30668635751/job/91281360364) |

Deltas are 30s–1m46s per job on one pair each — consistent direction, modest size.
K8s Codegen Check did not trigger naturally (path filter); a manual dispatch [succeeded in 3m24s](https://github.com/grafana/grafana/actions/runs/30671583796) vs a 5.4m historical max, and its log shows `Cache saved with the key: setup-go-Linux-arm64-...` — proving the cache is now active for this job, but that run was a cache **miss**, so no restore-side speedup is demonstrated for it.

**S3 remote Go cache, enterprise unit shards — 6m38s–8m13s → 4m00s–4m55s.**
Pre-change (azure-monitor PR): [fast shard 6m38s](https://github.com/grafana/grafana/actions/runs/30668635672/job/91281447080), [slow shard 8m13s](https://github.com/grafana/grafana/actions/runs/30668635672/job/91281447103).
Populating run (branch): [5m27s](https://github.com/grafana/grafana/actions/runs/30668721332/job/91282068552)–[6m53s](https://github.com/grafana/grafana/actions/runs/30668721332/job/91282068599).
Warm run (branch): [4m00s](https://github.com/grafana/grafana/actions/runs/30669482534/job/91283991867)–[4m55s](https://github.com/grafana/grafana/actions/runs/30669482534/job/91283991851).
Logs show AWS role assumption from the public repo, plugin sha256 verification, and `GOPROXY=http://localhost:12345/mod` in the test env. Honest note: `go: downloading` line counts did **not** drop (604 warm vs 603 populating) — fresh runners always populate a local module cache; the lines now resolve via the S3 proxy.

**Parallel catalog plugin downloads — 1m58s → 1m34s targz job.**
Branch: [build targz, 1m34s](https://github.com/grafana/grafana/actions/runs/30669482661/job/91285210933), log shows byte-interleaved concurrent curl output, catalog bundling ~1.5s in-log.
Baseline: [build targz, 1m58s](https://github.com/grafana/grafana/actions/runs/30668635733/job/91282528270).
gen-apps parallelism: the [Validate Backend Configs log](https://github.com/grafana/grafana/actions/runs/30669482498/job/91283995181) shows 8 simultaneous `go get grafana-app-sdk` lines at the same timestamp; no pre-change timing of that portion was captured, so no delta is claimed.

**Playwright browser cache — install now restores from cache, 27s → 13s (one pair).**
Branch: [Playwright shard 1/8](https://github.com/grafana/grafana/actions/runs/30669482588/job/91284886923), log `Cache restored from key: playwright-Linux-X64-1.56.1-chromium`, install step 13s.
Baseline: [same job on another PR](https://github.com/grafana/grafana/actions/runs/30666234993/job/91274942407), install step 27s. The delta is small because runners appear to download quickly; the cache mainly removes rate-limit/network variance exposure, which this data cannot quantify.

### Verified mechanism, no measurable win claimed

- **Schema-v2 e2e workflow removed**: absent from the branch's 39 head runs; [baseline PR ran it](https://github.com/grafana/grafana/actions/runs/30666234835). [Policybot passes](https://github.com/grafana/grafana/actions/runs/30669482516). Compute saved equals that workflow's cost, but no like-for-like timing pair exists by construction. The deleted job was structurally unable to fail (see deleted `run-schema-v2-e2e.yml`: `continue-on-error`, `|| echo`, forced `exit 0`), so no test signal was lost.
- **Blobless enterprise clone**: log shows `git clone --filter=blob:none --no-tags`; Setup Enterprise step [3s branch](https://github.com/grafana/grafana/actions/runs/30669482534/job/91283991838) vs [5s baseline](https://github.com/grafana/grafana/actions/runs/30668635672/job/91281447049). **2 seconds — no meaningful win on these runners.**
- **Coverage workers 1→4**: branch logs show `--maxWorkers=4` ([dataviz job](https://github.com/grafana/grafana/actions/runs/30669482567/job/91284292936)), baseline shows `--maxWorkers=1` ([job](https://github.com/grafana/grafana/actions/runs/30668565314/job/91281500452)). Durations: 10m30s vs 11m33s (dataviz pair) — **within noise**. The second comparison originally cited (10m02s vs 9m44s) turned out to be different teams' jobs and is withdrawn.
- **Dead steps removed**: [branch Integration run](https://github.com/grafana/grafana/actions/runs/30669482597) has no detect-changes job; [same-day main run](https://github.com/grafana/grafana/actions/runs/30669169926) has it. junit-report install absent from shard logs. Saving: one full-history checkout job per run, unquantified.
- **Local check-jobs action**: gate job logs show `Run ./.github/actions/check-jobs` after a checkout, no `@main` cross-repo download. Correctness/pinning fix only.
- **API-clients lint gating**: jobs now depend on detect-changes and ran (branch touches frontend). The saving exists only on docs-only PRs, which this branch cannot demonstrate.
- **setup-go retry**: step lists show attempt-1 success + skipped retry steps. **The rescue path has never fired**; unproven until a real 403 occurs.
- **Shard-script single-pass rewrite**: all shards pass; listing time not isolatable in logs. No CI-visible evidence beyond "not broken".

## grafana/grafana-enterprise (PR #12912)

### Verified with measurements

**Shallow branch fetch — Set up Grafana Enterprise step 1m52s → 6s.**
Branch: [SQLite 1/16](https://github.com/grafana/grafana-enterprise/actions/runs/30669477131/job/91283920570), step 6s, log shows `git -C grafana fetch --depth=1 origin ci-runner-optimizations`.
Baseline: [SQLite 1/16 on another PR](https://github.com/grafana/grafana-enterprise/actions/runs/30666510144/job/91274750050), step 1m52s.
This step runs in every one of ~170 jobs per PR (count from workflow inventory, not independently measured per job).

**S3 remote Go cache, integration shards — 6m15s → 3m53s (SQLite 1/16 pair).**
Same two jobs as above: branch job 3m53s with `Setup Go` at 8s (no tarball restore; separate "Set up remote Go cache" step 9s, plugin sha256 OK); baseline job 6m15s with a 37s Setup Go restore. Test step itself: 3m19s vs 3m32s — **the savings are mostly setup overhead, not test execution**.

**Chromium/--check-cache removal — shards 3m34s–6m20s vs 5m54s–9m26s.**
Branch ([run](https://github.com/grafana/grafana-enterprise/actions/runs/30669477199)): [14/16 3m34s](https://github.com/grafana/grafana-enterprise/actions/runs/30669477199/job/91283977546), [15/16 6m20s](https://github.com/grafana/grafana-enterprise/actions/runs/30669477199/job/91283977568). Logs contain zero `chromium`/`check-cache` matches.
Baseline ([concurrent PR run](https://github.com/grafana/grafana-enterprise/actions/runs/30669192331)): [14/16 5m54s](https://github.com/grafana/grafana-enterprise/actions/runs/30669192331/job/91283911376), [15/16 9m26s](https://github.com/grafana/grafana-enterprise/actions/runs/30669192331/job/91283911331).
Caveat: one branch shard failed an alerting test that passed the previous branch run — consistent with a flake, not proven to be one.

**Golden-files cache — 23s on hit.**
[Job](https://github.com/grafana/grafana-enterprise/actions/runs/30669477199/job/91283915293), log `Cache hit for: golden-files-...`, Setup Go and generation skipped. No pre-change baseline job was sourced for this repo, and the miss path was never observed — no delta claimed.

**ini dump removed from logs.**
Main's e2e job log [contains `app_title =` ini content](https://github.com/grafana/grafana-enterprise/actions/runs/30664748819/job/91269973455); the branch's equivalent jobs contain [zero occurrences](https://github.com/grafana/grafana-enterprise/actions/runs/30669477197/job/91289290469). Log-noise fix; no speed claim.

### Regressions found by this verification (both mine, both fixed on the branch, both unvalidated)

**1. e2e server composite broke licensed e2e suites.**
[Enterprise E2E: 18 failed](https://github.com/grafana/grafana-enterprise/actions/runs/30667557825/job/91278957721) (earlier branch commit; on the latest head the job was [cancelled](https://github.com/grafana/grafana-enterprise/actions/runs/30669477197/job/91289290469), not rerun) and [OEM E2E: 4 failed](https://github.com/grafana/grafana-enterprise/actions/runs/30669477197/job/91289290441) on the branch, while [both pass on main](https://github.com/grafana/grafana-enterprise/actions/runs/30664748819). Cause visible in the failing job log: the composite receives `cfg:enterprise.license_path="$PWD/..."` via an env var, `$PWD` is never expanded, the server runs unlicensed, and exactly the license-dependent tests fail. Fixed by expanding the path with workflow templating; **fix is committed but no CI run has validated it yet**.
The composite itself works where no license is involved: playwright shards show one "Set up E2E server" step ending in "The Grafana server is ready" and pass at durations comparable to baseline (5.5–7m vs 5.5–8m) — **a deduplication change, no speed win**.

**2. S3 cache made the apiserver e2e job slower.**
Main baseline: [Run test 10m59s](https://github.com/grafana/grafana-enterprise/actions/runs/30664748819/job/91271255759). Branch with remote cache: [Run test 19m56s](https://github.com/grafana/grafana-enterprise/actions/runs/30669477197/job/91289291315) and [16m41s on the prior branch commit](https://github.com/grafana/grafana-enterprise/actions/runs/30667557825/job/91279646435). The job compiles with `go test -p=1`; serialized compilation turns per-object remote-cache round-trips into pure added latency. The apiserver part of that commit is reverted; **revert unvalidated until the next run**.

### Structural only (not observable in run data)

Change-detection gates on Verify i18n / Backend Generated Code / lint-knip (jobs ran because the branch touches code; the skip saving needs a docs-only PR), Bash Unit Tests push filter (only pull_request runs on the branch — consistent, but no push event occurred to prove the negative), timeout-minutes (provable only by a hang), checkout-action quoting fix.

### Enterprise wall-clocks: no improvement claim

On the latest head runs, several enterprise workflow wall-clocks were **worse** than the historical PR averages (integration 17.6m vs 12.5m avg; unit 14.4m vs 9.9m; e2e ~35m vs 22m). The run data attributes this to 3–6 minute runner-queue waits during the simultaneous-start burst plus the two regressions above. Step-level pairs in the same runs (linked above) show the underlying work got faster. A clean, post-fix, non-burst run is required before any enterprise wall-clock claim can be made.

## Not deployed / open items

1. **OSS integration-test S3 cache**: commit held locally, unpushed — requires the IAM trust extension (deployment_tools branch `ale/grafana-cicd-trust-oss-integration-tests`, edit pending). OSS integration shards therefore still re-download test-only modules every run.
2. Force-push enterprise branch → validate the license fix (Enterprise/OEM e2e green) and the apiserver revert (~11m expected).
3. Drop both "Touch all CI trigger groups" evaluation commits before merge.
4. Verify no GitHub ruleset pins the removed check names (`build docker`, old Test Dockerfile variant names) — not checkable without repo admin.
5. Unproven items that only future events can validate: setup-go retry rescue path, golden-files miss path, k8s-codegen cache restore, docs-only-PR gating savings, cross-PR cache-eviction effects on the shared 10GB Actions cache.
