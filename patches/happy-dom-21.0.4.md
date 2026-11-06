# Happy DOM 21.0.4 patch

Patch: [happy-dom-21.0.4.patch](happy-dom-21.0.4.patch)

## Why this patch exists

Grafana uses Happy DOM as an alternative Jest environment for its component tests.
Style calculation and selector matching perform repeated work and allocate temporary objects during DOM queries and CSS evaluation.
This patch reduces that work while preserving observable behavior.
It also corrects cache behavior that can return results for the wrong context or hide selector errors.

## Performance optimizations

- **Reuse style caches.** Return valid computed-style results before helper construction or ancestor traversal.
  Record the inline-style attribute cache key so repeated reads do not parse the same value again.
- **Reuse parsed selectors.** Read cached selector plans without parser construction.
  During CSS evaluation, share one parsed plan across the candidate elements for a rule.
- **Reduce candidate matching.** Build an invocation-local index for simple class, ID, and tag selectors.
  Match only relevant elements instead of every element under consideration.
- **Reduce class-matching overhead.** Read cached class tokens without repeated public proxy method binding.
  Reject standalone class mismatches before cache-dependency bookkeeping.
- **Avoid selector-array copies.** Traverse parsed selector groups by index instead of repeated slicing and reversal.
- **Remove redundant work.** Avoid an overwritten style-manager clone, read adopted stylesheets once per discovery call, and reduce temporary allocations.

These changes target execution time and allocation overhead.
Their effect on total shard runtime, RSS, and GC requires a controlled benchmark comparison.

## Correctness fixes and safeguards

- **Match caches distinguish context.** A cached match must use the same scope and error-handling policy as the current request.
  A result from one scope must not answer a request for another scope.
- **Parser caches distinguish policy.** Reuse a parsed plan only with the same error-handling policy and global matching callback.
  A permissive CSS lookup must not suppress an error from a later strict query.
- **Failed queries do not publish results.** Store query results only after successful evaluation.
  An exception must not leave a cached empty or partial result that hides the error on a later call.
- **Inline styles match their serialized attributes.** Cache the normalized attribute value after `cssText` assignment.
  If shorthand serialization changes the declarations, rebuild the cached manager from that value.
- **Unsafe fast paths use the full matcher.** Shadow hosts, fragments, and shadow descendants retain the full CSS matching path.
  Complex selectors also retain the full path instead of the simple candidate index.

Some changes serve both purposes: cache-key maintenance avoids repeated work, while context checks prevent incorrect reuse.

## Behavior and scope to preserve

- CSS specificity, source order, `!important`, inheritance, custom properties, and `@scope` boundaries must remain intact.
- DOM mutations, stylesheet changes, and CSSOM edits must invalidate affected results.
- Disconnected elements must not reuse computed styles from their previous connected state.
- Selector traversal must preserve document order, deduplication, first-match behavior, and specificity.
- Parsed plans must remain reusable across queries without mutation or retained per-query scope.
- Class-token access must observe attribute changes and must not mutate the internal token cache.

The patch changes Happy DOM's CSS and selector implementation under `lib/`.
The separate [Jest environment adapter](../public/test/happy-dom-environment.js) handles other environment compatibility behavior.
Timer and DOMException compatibility changes in that adapter are not part of this package patch.

## Regression tests

The focused suites are:

- [happy-dom-css.node.cjs](../scripts/test-harness/environment/happy-dom-css.node.cjs): cascade behavior, cache reuse, mutation invalidation, candidate filtering, and shadow-tree fallbacks.
- [happy-dom-selectors.node.cjs](../scripts/test-harness/environment/happy-dom-selectors.node.cjs): selector traversal, cache context, errors, and class matching.

These harness tests run separately from source-test shards.

From the repository root, install dependencies with pnpm:

```sh
pnpm install --frozen-lockfile
```

pnpm applies the patch through `patchedDependencies` in [pnpm-workspace.yaml](../pnpm-workspace.yaml).
`npm install` does not apply this patch configuration.

Run the focused package regressions:

```sh
node --test scripts/test-harness/environment/happy-dom-css.node.cjs scripts/test-harness/environment/happy-dom-selectors.node.cjs
```

Run all Happy DOM environment checks, including the adapter regressions:

```sh
npm run test:happy-dom:environment
```

Run a source-test shard with memory and GC metrics:

```sh
npm run test:bench:happy-dom -- --shard=5/8 --metricsFile=happy-dom-shard-5.metrics.json
```

The [benchmark guide](../scripts/jest-benchmark.md) describes roster replay and instrumentation overhead checks.
A jsdom-versus-Happy-DOM comparison includes the environment and transformer changes, not only this patch.
To isolate this patch, compare patched and unpatched Happy DOM with the same transformer, roster, dependencies, and benchmark flags.

## When to remove the patch

A replacement Happy DOM version must preserve the correctness fixes and remove the need for the local optimizations.
Passing correctness tests alone does not establish equivalent performance.

1. In a candidate upgrade, remove the patch registration and install the replacement version without this patch.
2. Run both focused suites and all environment checks.
3. Run the affected source-test shards with the same roster.
4. Compare repeated benchmark runs under the same machine conditions, including runtime, RSS, and GC metrics.
5. If correctness and performance are acceptable, remove obsolete patch files and update the dependency pins, overrides, and lockfile.

If upstream replaces only some changes, retain the remaining changes and their regression coverage.
