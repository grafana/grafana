# Jest shard benchmarks

## Baseline runner commit

The runner can be committed directly after `a7c265f91c48d83f97d5849c4e4842983d8ab535`, before the Happy DOM experiment.
That commit needs only the runner, its support modules and tests, this documentation, and the jsdom/runner npm commands.
It does not need new dependencies, optimized tests, a custom environment, or roster JSON files.

From the initial runner commit, run:

```sh
pnpm install --frozen-lockfile
npm run test:bench:jsdom -- --shard=5/8
```

This explicitly selects shard `5/8`, with four workers and a fresh Jest cache.
Without optional configuration, the runner uses `jest.config.js`, jsdom, and the source suites selected by Jest.
There are no split-suite additions and no branch-specific roster exclusions.

Later commits can add the optional JSON files with the improvements that need them.
Happy DOM is available only after a checkout supplies its environment configuration and dependencies. The runner does not install or substitute an upstream environment.

## Optional JSON configuration

The runner reads these files from its own repository root, in order, if they exist:

1. `jest.benchmark.json` for shared configuration.
2. `jest.benchmark.jsdom.json` or `jest.benchmark.happy-dom.json` for the selected environment.

Each file uses `"version": 1`. Unknown keys, malformed JSON, and invalid paths cause an error.
Missing files mean no additional configuration.

| Key | Effect |
| --- | --- |
| `jestConfig` | Select a root-relative Jest configuration file. Default: `jest.config.js`. |
| `testEnvironment` | Select an environment package or `./`-prefixed environment file. Default for jsdom: `jsdom`. Happy DOM requires an explicit value. |
| `include` | Add eligible suites matched by root-relative file paths or glob patterns. |
| `exclude` | Remove selected suites matched by root-relative file paths or glob patterns. |
| `groups` | Keep associated suites together. If any group member is selected, add all members. Each group contains at least two paths or patterns. |
| `shards` | Add `include`, `exclude`, and `groups` rules for an exact shard key, such as `"5/8"`. |

Example shared configuration:

```json
{
  "version": 1,
  "groups": [
    [
      "public/app/example/model.test.ts",
      "public/app/example/model.browser.test.ts"
    ]
  ],
  "shards": {
    "5/8": {
      "include": ["public/app/core/specs/*.test.ts"],
      "exclude": ["**/*.slow.test.ts"]
    }
  }
}
```

Example environment configuration in `jest.benchmark.happy-dom.json`:

```json
{
  "version": 1,
  "jestConfig": "jest.happy-dom.config.js",
  "testEnvironment": "./public/test/happy-dom-environment.js"
}
```

These JSON files belong with the later improvements, not the initial runner commit.
JSON configuration controls roster changes without runner source changes.

Roster arrays combine across shared, environment-specific, and matching shard rules. Environment-specific scalar values override shared values.
The runner first selects the normal shard, or reads a baseline selection report. It then applies additions, group expansion, and exclusions, in that order.
Groups expand transitively. Exclusions win and do not refill the shard. All final paths are deduplicated and sorted.

Patterns use Node's `path.matchesGlob` syntax, including `*`, `**`, and brace alternatives. Paths use `/` separators and cannot escape the repository.
An include or group pattern that matches no eligible Jest suites causes an error. An exclusion that matches nothing is allowed.
An empty final roster causes an error.

Includes, groups, and selection replay trigger an unsharded `--listTests` call to find eligible suites. This uses the discovery cache, not the execution cache.
Additions cannot bypass Jest's test eligibility. Configuration does not add arbitrary filesystem paths.
A replay fails if its final roster contains suites absent from the Jest inventory.
`--listTests` prints the final adjusted roster. Metrics record the applied rules, JSON hashes, and net additions and exclusions.

## Configured Happy DOM runs

Happy DOM runs require an environment configuration and its installed dependencies.
The selected Jest configuration controls the transformer, resolver, setup files, mocks, snapshots, and worker recycling.
The benchmark uses four workers and a fresh private Jest cache.

JSON roster groups keep associated suites together. Explicit per-test environment directives remain effective.
Without optional configuration, `test:bench:jsdom` uses the root Jest configuration with jsdom.

### Install

Use the Node and pnpm versions specified by the repository.

Install dependencies from the checkout's lockfile:

```sh
pnpm install --frozen-lockfile
```

This command installs the locked dependencies and applies the registered package patches without changing the lockfile.
Package downloads and approved installation scripts require network access and disk space.

Use pnpm for installation. `npm install` does not apply the patches registered in `pnpm-workspace.yaml`. Using `npm run` for the benchmark commands is supported.

### Validate the environment and transformer

On the optimized checkout, run the environment and transformer regression tests:

```sh
npm run test:happy-dom:environment
npm run test:happy-dom:transformer
```

These tests require the installed dependencies.
The optimized checkout contains dependency patch descriptions and focused regression commands beside the patch files in `patches/`.

### Run shards 1 and 5

Run each command separately:

```sh
npm run test:bench:happy-dom -- --shard=1/8
npm run test:bench:happy-dom -- --shard=5/8
```

`--shard` is required, including with `--listTests` or `--selectionFile`. If it is absent, the runner exits with an example:

```text
Missing required --shard option. Example: --shard=5/8.
```

To inspect the selection without running tests, use:

```sh
npm run test:bench:happy-dom -- --shard=1/8 --listTests
npm run test:bench:happy-dom -- --shard=5/8 --listTests
```

The benchmark prints the selected-suite count and selection hash. Test failures retain a nonzero exit code. Cleanup removes only the benchmark's private cache.

The runner replaces Jest's final path list with `Ran all selected test suites.` Per-suite output, failures, totals, and benchmark metrics remain visible.
On a color-capable terminal, Jest retains colors despite the stderr filter. The runner respects `FORCE_COLOR`, `NO_COLOR`, and `NODE_DISABLE_COLORS`.
Redirected output does not enable colors automatically.

To retain Jest colors through a pipe, set `FORCE_COLOR`:

```sh
FORCE_COLOR=1 npm run test:bench:jsdom -- --shard=5/8 2>&1 | tee benchmark.log
```

This command also writes ANSI color codes to the log file.

### Save per-suite results

To save Jest JSON for comparison with the original baseline, run:

```sh
npm run test:bench:happy-dom -- --shard=1/8 --outputFile=shard-1-happy-dom.json
```

The `--outputFile` option also works with `test:bench:jsdom`. Relative output paths resolve from the repository root. Absolute paths remain unchanged.

Only test execution receives the output path. Discovery still uses a separate cache. With `--listTests`, the runner does not write a results file.

The report includes suite timestamps, test counts, statuses, and assertion results. A failed test run retains its nonzero exit code.

## Source tests and harness tests

New correctness tests for the benchmark runner and optimizations live under `scripts/test-harness/`.
Subdirectories separate benchmark, environment, compiler, dependency-patch, helper, and regression coverage.
This directory is outside the source Jest roots, including those in the baseline commit.
The optimized branch also excludes it with one `testPathIgnorePatterns` entry: `'<rootDir>/scripts/test-harness/'`.

`jest.harness.config.js` selects this directory and removes that single ignore entry. These configuration changes are not part of the runner-only patch.
Jest-based harness suites use ordinary `*.test.ts` or `*.test.tsx` names. Node-based suites use their separate commands.

Baseline suites and their existing coverage remain in the source shards, including existing helper and tooling tests.
Optimizations can consolidate test cases and remove redundant setup or assertions without moving that coverage to the harness.
Only genuine split-suite companions add files to the eligible roster.
New optimization regression tests run separately, even when they test production code.
The `regressions/` subdirectory contains the new backend service, Drawer, datasource-filter, and pagination coverage.
Test utilities stay in their original locations so source tests can still import them.

Place new harness tests and benchmark fixtures under `scripts/test-harness/`.
Do not add filename classifiers or harness exclusions to the benchmark runner.

To run the Jest-based harness suites, use:

```sh
npm run test:harness
```

The Node-based suites retain their separate commands:

```sh
npm run test:happy-dom:environment
npm run test:happy-dom:transformer
npm run test:harness:boundaries
```

The boundary checks do not require frontend dependencies. The environment, compiler, and Jest-based harness suites require their installed dependencies.

The benchmark uses the checkout's Jest configuration without extra harness rules. Jest determines eligibility before shard selection.
Optional roster JSON files adjust source suites, not harness isolation.
The initial runner commit leaves existing baseline tests unchanged. Its new correctness tests are outside the baseline Jest roots.

Baseline roster replays retain the existing helper and tooling suites without compensating exclusions.
Split-suite groups keep extracted cases with their original suite during a replay.

## Memory and GC metrics

Each benchmark prints a two-column summary after the Jest results. Indented rows group timing, memory, process counts, and GC observations.
RSS sampling, process counts, and GC observation are enabled by default.
Discovery and report generation are outside the execution measurement.

Example layout with illustrative values:

```text
Benchmark summary
Timing
  Jest execution                    12.35 s
  Total (discovery/setup included)  15.68 s
  Exit code                         0
Memory (summed RSS @ 250ms)
  Sampled peak                      256.3 MiB
  Time-weighted average             128.1 MiB
  Samples                           50
Processes
  Node process starts               8
  Test-worker starts                4
  Test-worker replacements          1
  Haste-map worker starts           1
  Other worker starts               1
GC (observed aggregate)
  Duration                          0.015 s
  Events                            5
  Major duration                    0.011 s
  Minor duration                    0.004 s
  Missing final reports             0
```

The memory heading includes the sampling interval. `Missing final reports` counts process reports without final GC counters, not RSS samples.
`INCOMPLETE` appears beside affected section headings. Detailed warnings follow the table.
Unavailable or disabled metrics have explicit labels rather than fabricated zero values. The metrics JSON format is unchanged.

| Metric | Meaning |
| --- | --- |
| Sampled peak RSS | Maximum sampled sum of RSS for the Jest coordinator and its descendants. |
| Time-weighted average RSS | Average of the sampled RSS sum over execution time. Each sample applies until the next sample. |
| Test-worker starts and replacements | Process lifetimes, with replacements counted within each test-worker slot. |
| Haste-map worker starts | Separate worker processes for cold-cache file processing. These do not count as test-worker replacements. |
| Observed GC duration | Sum of GC event durations across Node processes, with major and minor durations in the terminal summary. |

RSS sampling uses Linux `/proc` every 250 ms. The sampler runs outside Jest, without overlapping polls or external commands.
RSS includes descendants that do not run Node. It excludes the benchmark runner itself.
Other platforms report RSS as unavailable, but retain the process counts and GC metrics.

The sampled peak can miss short spikes and short-lived descendants. Summed RSS counts shared pages more than once.
The sampler does not detect PID reuse between polls. RSS read errors appear as warnings and mark the measurements as incomplete.

A small Node preload records process starts, worker initialization, and normal exits.
It distinguishes the test-worker pool from the haste-map pool through Jest's initialization message.
Replacement counts include repeated starts for the same parent process, worker module, and worker ID.
They do not identify the replacement cause, such as a memory threshold or a crash.

The preload does not force GC or change worker recycling.
The root configuration retains `workerIdleMemoryLimit: '1GB'`, which is a heap-based recycling threshold, not a hard RSS limit.

### Save metrics

To save a separate metrics report, run:

```sh
npm run test:bench:happy-dom -- --shard=1/8 --metricsFile=shard-1.metrics.json
```

`--metricsFile` does not change the Jest JSON format from `--outputFile`. Both options can be used together, with different paths.
The terminal summary does not require either option.

The metrics report includes:

- Execution duration, exit code, and RSS measurements in bytes.
- Per-process records, worker counts, and GC counts and durations in milliseconds.
- The checkout revision and whether tracked files have changes. Untracked files are not part of this check.
- The Node version, inherited `NODE_OPTIONS`, platform, CPU information, and system memory.
- Hashes of the benchmark implementation and configuration files.
- The shard, worker count, selected suite paths, selection hash, and cold-cache policy.

Failed runs retain their exit code and produce metrics. Interrupted processes can leave incomplete snapshots.
`--listTests` does not start the collectors or write a metrics report.

### GC observation

GC observation is enabled by default.

To disable only GC observation, add `--noGc`:

```sh
npm run test:bench:happy-dom -- --shard=1/8 --noGc --metricsFile=shard-1-no-gc.metrics.json
```

`--noGc` retains RSS sampling and process counts.

GC observation updates counters inside each Node process. It does not retain individual events.
Each process writes a checkpoint every five seconds and a final snapshot on normal exit.
A killed process can lose events since its last checkpoint. The summary identifies processes without final snapshots.

GC durations are best-effort observations from `PerformanceObserver`. Pending notifications can be lost at exit, even with a final snapshot.
The `complete` field indicates a final process snapshot, not exhaustive GC accounting.
GC events in different workers can overlap. Their summed duration is neither GC CPU time nor wall time lost to GC.

## Compare the initial runner commit with the improvements

The runner always uses the repository that contains `scripts/jest-benchmark.mts`.
Each checkout supplies its own Jest installation, configuration, and tests.
The comparison measures the complete configurations: baseline jsdom with ts-jest, versus Happy DOM with Sucrase and optimized tests.

The runner-only patch targets `a7c265f91c48d83f97d5849c4e4842983d8ab535`. It adds the runner, generic JSON loader, collectors, regression tests, and this documentation.
It excludes the branch-specific roster and Happy DOM JSON files.
It adds `test:bench:jsdom` and `test:bench:runner` to the scripts in `package.json`.
It does not change dependencies, lockfiles, application tests, Jest configurations, or runtime code.
The harness tests are outside the baseline Jest roots, so the patch needs no Jest configuration changes.

Added test files can shift Jest's shard boundaries. The same shard number alone does not guarantee the same selected coverage.
`--selectionFile` replays the baseline report's suite paths without shard discovery, then applies the current checkout's JSON roster rules.
The requested shard must match the report. Missing selected files remain errors.

1. Apply `test-benchmark-runner-only.patch` at the baseline revision and commit the runner separately from the improvements.
2. Install each checkout's dependencies with its own lockfile.
3. From the initial runner commit, run the baseline:

   ```sh
   npm run test:bench:jsdom -- --shard=5/8 --metricsFile=shard-5-main.metrics.json --outputFile=shard-5-main.jest.json
   ```

4. Copy `shard-5-main.metrics.json` into the optimized checkout, or retain it when switching branches.
5. From the optimized repository root, run:

   ```sh
   npm run test:bench:happy-dom -- --shard=5/8 --selectionFile=shard-5-main.metrics.json --metricsFile=shard-5-optimized.metrics.json --outputFile=shard-5-optimized.jest.json
   ```

Relative report paths and `--selectionFile` resolve from the runner's own repository root.
JSON configuration controls roster additions and exclusions. Without roster JSON files, the baseline uses the suites selected by Jest.

For shard 1, replace `5/8` with `1/8` and use distinct report filenames.
Both commands collect GC metrics by default.
The optimized selection hash can differ because it includes split companions. The report lists the selected paths for inspection.

Compare `executionMs`, rather than `totalMs`, because roster discovery can differ between runs.
Use the same machine, Node version, inherited `NODE_OPTIONS`, and GC mode for both configurations.
Run the benchmarks sequentially. Alternate several baseline and optimized runs, with distinct report filenames, then compare medians and ranges.
Check the exit codes and Jest results before accepting a comparison.

### Check instrumentation overhead

`--noMetrics` disables RSS sampling and the preload, including GC observation.
It can still save timing and selection metadata through `--metricsFile`. Reports record both `metricsEnabled` and `gcEnabled` as false.

To measure GC overhead alone, alternate runs of the same selection with and without `--noGc`.
To measure all instrumentation overhead, alternate runs of the same selection with and without `--noMetrics`.
Compare execution durations over several runs. An overhead estimate from these runs does not establish overhead for every shard or machine.

To run the metrics and runner regression tests without frontend dependencies, use:

```sh
npm run test:bench:runner
```
