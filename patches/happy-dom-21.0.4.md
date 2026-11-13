# Happy DOM 21.0.4 patch

Patch: [happy-dom-21.0.4.patch](happy-dom-21.0.4.patch)

## Why this patch exists

Grafana uses Happy DOM as an alternative Jest environment for its component tests.
Style calculation and selector matching perform repeated work and allocate temporary objects during DOM queries and CSS evaluation.
This patch reduces that work while preserving observable behavior.
It also corrects cache behavior that can return results for the wrong context or hide selector errors.
The additional DOM fixes cover section rows, Location attributes, selection notifications, and timer/hashchange recovery after abort.

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

## Focused DOM fixes

These changes use existing Happy DOM classes and task tracking. They add no dependencies or general compatibility framework.
The new hunks include matching TypeScript source and runtime JavaScript. The rows addition also updates the declaration file.

### Live section rows

`HTMLTableSectionElement.rows` returns a cached `HTMLCollection` of direct HTML `tr` children.
The collection stays live across insertion, removal, reordering, and reparenting. Nested table rows do not enter the collection.

Each read of collection membership scans direct element children, not the descendant tree.
One collection is retained per section that accesses `rows`. There is no selector parsing, mutation observer, or invalidation cache.
Shared collection quirks and neighboring table methods remain outside this patch.

### Enumerable Location attributes

The Location constructor installs its nine existing URL accessors as own enumerable properties.
Object spread therefore includes `href`, `origin`, and the other URL attributes without per-test copying.
Native getters and setters remain responsible for URL values and updates.

This adds nine descriptors per Location, not per DOM node or URL read.
It does not copy URL strings, add a proxy, change navigation, or implement cross-origin reflection rules.
The nonconfigurable descriptors match the Firefox comparison, but do not establish complete Location conformance.

### Deferred selection notifications

Selection state still changes synchronously. Native `selectionchange` notifications run in a later task and coalesce while a notification is pending.
The callback clears pending state before listeners run. Explicit `dispatchEvent()` remains synchronous.

The implementation uses one window timer and one abortable task registration per pending notification.
Repeated changes before delivery add no timers or registrations. Coalescing avoids redundant listener work and prevents synchronous editor reentry.
A positive timeout keeps notifications outside Happy DOM's shared zero-delay batch.
This is a practical task boundary, not a complete browser task-source implementation.

`happyDOM.abort()` cancels the timer and clears pending state.
Jest's `clearAllTimers()` alone cannot notify Happy DOM that its fake timer disappeared.
When fake timers are discarded within a test, await `happyDOM.abort()` before reusing the window.
The shared Jest environment also aborts browser work after each completed test.

Input/textarea notifications and live Range mutation support remain separate work.

### Zero-delay batch recovery

Happy DOM groups zero-delay timers to reduce timer and task-manager overhead.
Previously, abort canceled the host timer but retained the pending batch. New zero-delay callbacks then joined a batch that could never run.

The batch now uses one abortable task registration instead of one timer registration.
Its abort callback clears both the host timer and the pending batch.
The patch retains batching, callback order, individual cancellation, and positive-delay behavior.
Tracking remains O(1) per batch, with one cancellation closure. It does not add a registration per callback.

### Hashchange cancellation and closing windows

Location now discards queued hashchange events when abort cancels their notification task.
Otherwise, a later hash change can replay canceled events to the next test's listeners.
Normal delivery retains every old/new URL pair in order. Repeated changes share one pending timer instead of canceling and recreating it.
The queue uses one abortable task registration, not one registration per hash change.

A read-only task-manager status getter prevents new selection, hashchange, or zero-delay tasks during destruction.
This covers XHR abort listeners that run before the window's closed flag changes.
The guards are constant-time checks and preserve silent timer cancellation during close.
The patch does not change the task manager's existing error contract or window destruction order.

These are bounded cost arguments, not benchmark results or claims of universal browser conformance.
The existing CSS and selector optimizations remain unchanged.

## Behavior and scope to preserve

- CSS specificity, source order, `!important`, inheritance, custom properties, and `@scope` boundaries must remain intact.
- DOM mutations, stylesheet changes, and CSSOM edits must invalidate affected results.
- Disconnected elements must not reuse computed styles from their previous connected state.
- Selector traversal must preserve document order, deduplication, first-match behavior, and specificity.
- Parsed plans must remain reusable across queries without mutation or retained per-query scope.
- Class-token access must observe attribute changes and must not mutate the internal token cache.

The original CSS and selector changes affect `lib/`. The focused DOM fixes also include their corresponding `src/` changes.
The separate [Jest environment adapter](../public/test/happy-dom-environment.js) handles Jest lifecycle, timer-wrapper, and DOMException compatibility.

For Circus, the adapter awaits `happyDOM.abort()` at `test_done`, after `afterEach` hooks finish.
This prevents unfinished browser work from entering the next test and releases discarded selection notifications.
It cancels all tracked browser work, including unfinished work from `beforeAll`.
Tests cannot rely on that work surviving between tests. Concurrent tests that share a window also share its cancellation scope.
This adapter policy is separate from the native package fixes.

## Regression tests

The focused suites are:

- [happy-dom-css.node.cjs](../scripts/test-harness/environment/happy-dom-css.node.cjs): cascade behavior, cache reuse, mutation invalidation, candidate filtering, and shadow-tree fallbacks.
- [happy-dom-selectors.node.cjs](../scripts/test-harness/environment/happy-dom-selectors.node.cjs): selector traversal, cache context, errors, and class matching.
- [happy-dom-collections-location.node.cjs](../scripts/test-harness/environment/happy-dom-collections-location.node.cjs): live row collections and enumerable, live Location attributes.
- [happy-dom-selection.node.cjs](../scripts/test-harness/environment/happy-dom-selection.node.cjs): task timing, coalescing, explicit dispatch, abort recovery, and both Jest timer modes.
- [happy-dom-zero-delay.node.cjs](../scripts/test-harness/environment/happy-dom-zero-delay.node.cjs): abort recovery, batching, cancellation, closing windows, and reentrant timers.
- [happy-dom-location-events.node.cjs](../scripts/test-harness/environment/happy-dom-location-events.node.cjs): canceled hashchange queues, ordered URL pairs, closing windows, and listener-triggered changes.
- [happy-dom-test-cleanup.node.cjs](../scripts/test-harness/environment/happy-dom-test-cleanup.node.cjs): shared cleanup and actual Circus execution across tests.

These harness tests run separately from source-test shards.

From the repository root, install dependencies with pnpm:

```sh
pnpm install --frozen-lockfile
```

pnpm applies the patch through `patchedDependencies` in [pnpm-workspace.yaml](../pnpm-workspace.yaml).
`npm install` does not apply this patch configuration.

Run the focused package regressions:

```sh
node --test scripts/test-harness/environment/happy-dom-css.node.cjs scripts/test-harness/environment/happy-dom-selectors.node.cjs scripts/test-harness/environment/happy-dom-collections-location.node.cjs scripts/test-harness/environment/happy-dom-selection.node.cjs scripts/test-harness/environment/happy-dom-zero-delay.node.cjs scripts/test-harness/environment/happy-dom-location-events.node.cjs
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

## Deliberate fallbacks

Sanitizer suites and the notebook print-layout suite retain jsdom coverage instead of weaker DOM assertions.
Descendant button activation also remains unpatched. A small dispatcher hook duplicated submissions through existing label forwarding.
Correcting that interaction needs more coordination than this patch includes. Abort cannot repair a synchronous activation error.

The separate [enterprise test patch](grafana-enterprise-happy-dom-tests.patch) changes the supplied enterprise snapshot's test sources.
It replaces location deletion/reassignment with a per-test getter spy and selects jsdom for `SecretItem` without changing its click target.
It is not a pnpm dependency patch and is not registered in `patchedDependencies`.
The external snapshot remains unchanged. The patch was validated against scratch copies and checked against the original files.

## When to remove the patch

A replacement Happy DOM version must preserve the correctness fixes and remove the need for the local optimizations.
Passing correctness tests alone does not establish equivalent performance.

1. In a candidate upgrade, remove the patch registration and install the replacement version without this patch.
2. Run the focused suites and all environment checks.
3. Run the affected source-test shards with the same roster.
4. Compare repeated benchmark runs under the same machine conditions, including runtime, RSS, and GC metrics.
5. If correctness and performance are acceptable, remove obsolete patch files and update the dependency pins, overrides, and lockfile.

If upstream replaces only some changes, retain the remaining changes and their regression coverage.
