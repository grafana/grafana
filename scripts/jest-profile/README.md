# Profile a Jest suite in Happy DOM

The default suite is `GrafanaReceiverForm.test.tsx`. It was the slowest suite in the supplied shard-1 log, at 26.878 seconds.

The script does not discover or benchmark the entire shard. By default, it measures this suite in two sequential, fresh processes:

1. Cold Jest transform cache.
2. The same cache, now warm.

## Run

From the repository root, run:

```sh
node scripts/jest-profile.cjs
```

For sampled function costs and CPU profiles, run:

```sh
node scripts/jest-profile.cjs --cpu
```

For another suite, specify its path:

```sh
node scripts/jest-profile.cjs --suite=public/app/core/specs/backend_srv.test.ts --cpu
```

The default heap limit comes from Node. For a memory-constrained machine, set an explicit limit:

```sh
node scripts/jest-profile.cjs --heap-mb=768
```

Each process has a 180-second deadline. To change the deadline, use `--timeout-seconds=300`.

## Opt-in SWC experiment

The default transformer remains the root Jest configuration (`ts-jest`). The `--transformer=swc` flag changes only the generated configuration for this run.

If the optional packages are absent, install them in an isolated directory:

```sh
npm install --prefix local/jest-dom-bench/swc-deps --no-save --package-lock=false @swc/jest@0.2.38 @swc/core@1.13.3
```

This command downloads packages and runs their installation scripts. It needs network access and disk space for the native SWC binary. The profiler never installs packages itself.

Run the cold baseline:

```sh
node scripts/jest-profile.cjs --cold-only --heap-mb=768
```

Then run the cold SWC experiment:

```sh
node scripts/jest-profile.cjs --cold-only --heap-mb=768 --transformer=swc --swc-jest=local/jest-dom-bench/swc-deps/node_modules/@swc/jest
```

Each command uses a new, private Jest transform cache. Neither command clears the operating-system filesystem cache. For repeated comparisons, alternate their order.

The `--suite=path` flag selects another suite. Without `--cold-only`, each command runs a cold/warm pair. If the root project already resolves `@swc/jest`, omit `--swc-jest`.

The experiment uses `@swc/jest` for Jest mock hoisting. It uses separate TypeScript, TSX, and JavaScript parser configurations. The target is ES2018, with automatic React JSX, legacy decorators, assignment-style class fields, CommonJS, and source maps.

These choices approximate the current TypeScript configuration. They do not establish full semantic equivalence. The experiment disables external SWC configuration files for reproducibility.

### Compatibility and measured results

Local cold runs used Node v26.12.1, Jest 29.7.0, Happy DOM, and a 768 MiB heap limit. Processes ran sequentially, without CPU sampling. Each row represents one run per transformer, not repeated statistical measurements.

| Suite | ts-jest process wall | SWC process wall | ts-jest transformer work | SWC transformer work | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| `GrafanaReceiverForm.test.tsx` | 56.65 s | 32.48 s | 21.35 s | 3.16 s | Both: 31 passed, same local OnCall failure |
| `backend_srv.test.ts` | 22.87 s | 11.68 s | 11.70 s | 1.70 s | Both: 62 passed, 175 matcher calls |

The receiver runs transformed the same 2,024 files. The backend-service runs transformed the same 1,148 files. Receiver matcher calls differed (193 versus 186). Its tests contain retried assertions inside `waitFor`, so matcher counts are not fixed assertion-site counts.

SWC also passed all 83 `DashboardSidebar.test.tsx` tests and the `createSpacing.test.ts` smoke test.

**SWC is not a drop-in replacement.** `processDataFrame.test.ts` passed all 39 tests under `ts-jest`. Under SWC, 38 tests passed and the existing module-export spy failed:

```text
TypeError: Cannot redefine property: guessFieldTypes
```

The failure occurs at `jest.spyOn(guessFieldTypeModule, 'guessFieldTypes')`. SWC emits a nonconfigurable export getter. The experiment does not modify the test or patch `Object.defineProperty` to hide this difference. Its existing snapshot passed under both transformers.

These results show substantially lower cold transformation cost, not a proven CI-shard speedup. A shard shares transformed files across suites. The local dependency installation also differs from the complete workspace installation.

Before adoption, compatibility requires more work. A full cold shard must retain its test selection, assertions, snapshots, mock behavior, console enforcement, and isolation.

## SWC mutable exports and Sucrase

These additional modes remain opt-in. They do not change the root Jest configuration or application tests.

### SWC with mutable exports

The mutable-exports plugin changes SWC exports to permit replacement and restoration by Jest spies. This is a compiler transformation, not a global `Object.defineProperty` patch.

Install the tested version combination in the isolated directory:

```sh
npm install --prefix local/jest-dom-bench/swc-deps --no-save --package-lock=false @swc/jest@0.2.38 @swc/core@1.13.3 @swc-contrib/mut-cjs-exports@11.0.2
```

Run the existing export-spy suite:

```sh
node scripts/jest-profile.cjs --cold-only --heap-mb=768 --transformer=swc-mutable --swc-jest=local/jest-dom-bench/swc-deps/node_modules/@swc/jest --suite=packages/grafana-data/src/dataframe/processDataFrame.test.ts
```

The profiler resolves the plugin from the selected SWC adapter. It records the plugin version in `run.json`. Plugin and core versions require compatibility checks before upgrades.

Each invocation places the SWC plugin cache inside its private Jest cache. The cold run includes WASM compilation. A warm run can reuse that cache. Cleanup removes both caches after the invocation.

### Sucrase

Install the tested packages in a separate directory:

```sh
npm install --prefix local/jest-dom-bench/sucrase-deps --no-save --package-lock=false @sucrase/jest-plugin@3.0.0 sucrase@3.35.1
```

Run the existing export-spy suite:

```sh
node scripts/jest-profile.cjs --cold-only --heap-mb=768 --transformer=sucrase --sucrase-jest=local/jest-dom-bench/sucrase-deps/node_modules/@sucrase/jest-plugin --suite=packages/grafana-data/src/dataframe/processDataFrame.test.ts
```

The adapter supplies per-extension parsing, Jest hoisting, and source maps. The profiler selects automatic JSX and CommonJS dynamic imports. It enables Sucrase's ES transforms to retain assignment-style class fields rather than native define-style fields.

Sucrase does not transpile decorators. It does not provide an exact equivalent of the SWC ES2018 target.

### Trial results

These runs used the same local installation, Happy DOM, and 768 MiB limit as the earlier trial. Each run used a new cache and no CPU sampling.

| Suite | SWC mutable exports | Sucrase |
| --- | --- | --- |
| `processDataFrame.test.ts` | 39 passed, 1 snapshot, 104 matcher calls | 39 passed, 1 snapshot, 104 matcher calls |
| `backend_srv.test.ts` | 62 passed, 175 matcher calls | Import failure before test collection |
| `DashboardSidebar.test.tsx` | 83 passed, 245 matcher calls | Not run after the import failure |
| `GrafanaReceiverForm.test.tsx` | 31 passed, same local OnCall failure | Not run after the import failure |

| Suite | Earlier ts-jest wall / transformer work | SWC mutable wall / transformer work |
| --- | ---: | ---: |
| `backend_srv.test.ts` | 22.87 s / 11.70 s | 12.76 s / 3.88 s |
| `GrafanaReceiverForm.test.tsx` | 56.65 s / 21.35 s | 37.23 s / 7.71 s |

The plugin adds cost compared with plain SWC, but both comparisons retain substantial cold transformation savings. The paired runs transformed the same numbers of files. Receiver matcher calls were 185 with the plugin, versus 193 in the earlier ts-jest run.

Sucrase failed in `packages/grafana-schema/src/veneer/common.types.ts`:

```text
TypeError: Cannot set property defaultTableFieldOptions of [object Object] which has only a getter
```

The file uses `export *` and then declares a local export with the same name. Sucrase creates a getter for the re-export, then assigns to that getter-only property. The trial leaves this failure intact. Its incomplete run is not a speed measurement.

SWC with mutable exports was the viable candidate from these initial trials. The patched Sucrase prototype below extends the comparison. This result does not establish complete module-semantic equivalence or a full-shard speedup. No production code, application tests, assertions, mocks, or snapshots changed for either trial.

## Patched Sucrase prototype

The prototype corrects four compatibility problems without a separate mutable-exports plugin:

- Explicit runtime exports take precedence over star re-exports, regardless of declaration order.
- Comma-separated exported variables retain their initializers and inferred function/class names.
- Optional TypeScript class methods retain their bodies with class-field transforms enabled.
- Leading block-comment `@jsxImportSource` directives select the JSX runtime, including Emotion.

The export correction retains Sucrase's configurable live re-export getters. It does not patch global property descriptors or rewrite application tests.

**These patches modify the CommonJS distribution of Sucrase 3.35.1 only.** They do not update upstream TypeScript source or the ESM distribution. The selected Jest adapter uses this CommonJS distribution.

### Apply and run

If the stock packages are absent, use the isolated installation command in the Sucrase section first.

Create a separate copy from the unmodified installation:

```sh
cp -a local/jest-dom-bench/sucrase-deps local/jest-dom-bench/sucrase-patched-deps
```

Apply the patches in this order, from the repository root:

```sh
git apply --directory=local/jest-dom-bench/sucrase-patched-deps/node_modules/sucrase scripts/jest-profile/sucrase-3.35.1-export-precedence.patch
git apply --directory=local/jest-dom-bench/sucrase-patched-deps/node_modules/sucrase scripts/jest-profile/sucrase-3.35.1-syntax.patch
git apply --directory=local/jest-dom-bench/sucrase-patched-deps/node_modules/sucrase scripts/jest-profile/sucrase-3.35.1-jsx-import-source.patch
```

Run the compiler regression tests:

```sh
SUCRASE_TEST_PACKAGE=local/jest-dom-bench/sucrase-patched-deps/node_modules/sucrase node --max-old-space-size=768 --test scripts/jest-profile/sucrase-exports.test.cjs
```

Without `SUCRASE_TEST_PACKAGE`, these optional compiler tests skip. The prototype passed all 55 tests, including export precedence, live bindings, descriptor restoration, syntax, and JSX runtime selection.

Run a cold representative suite:

```sh
node scripts/jest-profile.cjs --cold-only --heap-mb=768 --transformer=sucrase --sucrase-jest=local/jest-dom-bench/sucrase-patched-deps/node_modules/@sucrase/jest-plugin --suite=public/app/core/specs/backend_srv.test.ts
```

The remaining representative paths are:

- `packages/grafana-data/src/dataframe/processDataFrame.test.ts`
- `public/app/features/dashboard-scene/sidebar/DashboardSidebar.test.tsx`
- `public/app/features/alerting/unified/components/receivers/form/GrafanaReceiverForm.test.tsx`

### Final prototype results

Each cell contains process wall time / transformer work. These are single cold-cache runs, not statistical estimates. The comparison runs occurred earlier.

| Suite | ts-jest | SWC mutable | Patched Sucrase | Result |
| --- | ---: | ---: | ---: | --- |
| Data frame | 6.57 / 1.83 s | 4.09 / 0.62 s | 4.42 / 0.44 s | 39 passed, 1 snapshot |
| Backend service | 22.87 / 11.70 s | 12.76 / 3.88 s | 11.44 / 1.81 s | 62 passed |
| Dashboard sidebar | Not measured | 24.66 / 8.70 s | 19.75 / 3.65 s | 83 passed |
| Receiver | 56.65 / 21.35 s | 37.23 / 7.71 s | 32.82 / 3.04 s | 31 passed, same local OnCall failure |

The receiver row is diagnostic, not a successful benchmark. Its existing accessible-radio query still fails. No assertion, mock, snapshot, console check, or application test changed.

Final profiles are `suite-NvcW02`, `suite-AYalzE`, `suite-Z6Bt9w`, and `suite-jWqFwb`, in table order. Each profile remains under `local/jest-dom-bench/profiles/`.

Test names and statuses match the comparison runs. Backend, sidebar, and receiver module sets also match after the JSX correction. Data frame omits only TypeScript's `tslib` helper module.

Matcher counts are 104, 175, 245, and 185, respectively. Receiver matcher counts vary because `waitFor` retries assertions. Matching counts alone do not prove semantic equivalence.

Sucrase approaches plain-SWC transformation cost without the WASM mutable-exports pass. The small data-frame suite still has a higher wall time than mutable SWC.

These results support a larger trial, not immediate adoption. Remaining checks include a full cold shard, repeat measurements, decorator usage, and broader module semantics. Sucrase does not transpile decorators, and these patches do not implement all JSX pragma forms.

## Output

Each invocation creates a unique directory under `local/jest-dom-bench/profiles/`. The command prints the exact path.

| File | Contents |
| --- | --- |
| `cold.report.txt`, `warm.report.txt` | Readable cost breakdown and slowest operations |
| `cold.attribution.json`, `warm.attribution.json` | All counters, module load parents, lifecycle events, and costs by phase |
| `cold.trace.json`, `warm.trace.json` | Chrome Trace Event timelines for module loads, transforms, hooks, and test bodies |
| `cold.results.json`, `warm.results.json` | Jest results and assertion failures |
| `cold.log`, `warm.log` | Jest console output |
| `run.json` | Revision, Node version, transformer selection, compiler and plugin versions, command arguments, limits, process times, test counts, and summaries |
| `cold.cpuprofile.gz`, `warm.cpuprofile.gz` | Optional V8 CPU profiles, with 4 ms sampling |

With `--cold-only`, the directory contains no warm-run files.

For the initial analysis, share `run.json` and the available report files. CPU profiles are useful for deeper analysis. Logs are useful when tests fail.

To inspect a CPU profile, decompress its `.cpuprofile.gz` file. Then load the `.cpuprofile` file in Chrome DevTools, under JavaScript Profiler.

A Chrome Trace Event viewer can open the `.trace.json` files. These files contain nested spans, not CPU samples.

The artifacts contain local file paths, test names, and potentially application logs. Review them before sharing them outside your organization.

## Read the breakdown

### Lifecycle time

The lifecycle table partitions elapsed time into these phases:

- Initial Jest startup and discovery.
- Happy DOM environment construction.
- Jest framework and setup files.
- Suite imports and test collection.
- Test bodies.
- Hooks, grouped by hook type.
- Time between tests, teardown, and reporting.

A test body can include deferred imports, rendering, queries, assertions, timers, and I/O waits. It is not necessarily CPU-bound work.

### Cost buckets

The cost table partitions the same elapsed time by the active instrumented operation.

| Bucket | Meaning |
| --- | --- |
| `transformer process` | Actual synchronous `transformer.process()` work, including its plugins and source-map work |
| `transformer cache key` | Transformer cache-key computation, including initialization that occurs inside that call |
| `transform pipeline` | Remaining measured Jest transformation work, including cache access and output processing |
| `resolution` | Instrumented Jest module-resolution calls |
| `V8 script creation` | Jest `createScriptFromCode()`, including script wrapping and V8 compilation |
| `module execution/loading` | Remaining measured Jest module execution and loader work |
| `automatic mock generation` | Remaining measured automatic-mock work after nested operations |
| `other` | Everything outside these hooks, including native module loading, ordinary test execution, and waits |

The buckets exclude nested measured work. Their totals do not double-count a transform inside a module load.

Lifecycle totals and cost totals describe the same interval. **Do not add these two tables together.**

Individual module rows include both inclusive time and self time. Inclusive time includes child imports. Inclusive rows overlap and cannot be added together.

Module self time is not pure application JavaScript time. It also contains uninstrumented loader work and some instrumentation overhead.

The JSON file preserves each cost bucket for each lifecycle phase. This distinguishes an import during test execution from an import during collection.

### Transformer calls and repeated modules

An actual `transformer.process()` call is different from a request for transformed code. A warm run can load thousands of modules without new transformer calls.

The report counts actual transformations and distinct transformed files. It also counts module executions and repeated executions of each module.

A repeated module execution does not necessarily mean repeated compilation. Jest isolation and automatic mocks can evaluate cached code again.

### CPU sampling

With `--cpu`, the report lists functions with the most sampled self time during startup, tests, and teardown.

Self time belongs to the sampled frame, not its callers. The full profile supports inclusive-stack analysis.

These samples include idle and garbage-collection samples. They are not equivalent to operating-system CPU counters.

The report also includes process user/system CPU time and peak resident memory. Native threads can make process CPU time exceed elapsed time.

## Compare with a production build

A faster transformer can reduce `transformer process` time. It cannot directly remove DOM work, React rendering, assertions, or Jest module evaluation.

A production bundler builds and optimizes a module graph. Jest also executes module code and tests inside an isolated environment.

Jest evaluates CommonJS barrel exports rather than applying production tree shaking. Other suites can evaluate much of that graph again.

These differences do not make the current transformer cost acceptable by definition. They identify which costs a replacement tool can address.

The opt-in SWC experiment measures transformation savings directly. The default command still uses the current root Jest transform configuration.

## Limits and safety

- The hooks support Jest 29 and synchronous CommonJS transformation. Unsupported Jest versions and asynchronous ESM transformation produce explicit errors.
- Happy DOM is mandatory. The script rejects suites with environment docblocks because those docblocks override the configured environment.
- The script preserves the root resolver, setup files, tests, assertions, and console enforcement. It sets `CI=true`. Only explicit selection of an alternative transformer overrides transforms.
- A local configuration disables worker recycling and watch plugins. Otherwise, `workerIdleMemoryLimit` can create a worker despite `--runInBand` and leave the profiler on an idle coordinator.
- The normal Jest cache remains untouched. The script removes only its generated transform cache after the run or pair.
- No package installation, manifest change, or network request is part of the script itself. Tests retain their existing network behavior.
- The runner preserves test failures and nonzero exit codes. Failed runs are diagnostic evidence, not successful benchmarks.
- Instrumentation and CPU sampling add overhead. Cold/warm differences also contain filesystem-cache effects and run variation.
- A warm run reuses transforms, not the Jest module registry. Both runs use fresh processes.
- An isolated cold suite does not represent a four-worker shard with a shared transform cache.
- Disk checks require 128 MiB free without CPU sampling and 256 MiB with sampling. Large CPU profiles can require more space before compression.
- A process killed at its deadline cannot necessarily write a final trace or CPU profile.

## Validate the profiler

Run the Node tests:

```sh
node --test scripts/jest-profile/profile.test.cjs
```

The tests cover nested cost accounting, lifecycle boundaries, exceptions, repeated calls, CPU-clock alignment, limits, child exit codes, and deadlines.
They also cover transformer selection, optional dependency resolution, and parser configurations. These configuration tests require no SWC installation.
