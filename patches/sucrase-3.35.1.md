# Sucrase 3.35.1 patch

Patch: [sucrase-3.35.1.patch](sucrase-3.35.1.patch)

## Why this patch exists

Grafana's optimized Jest configuration replaces `ts-jest` with Sucrase through `@sucrase/jest-plugin`.
This change aims to reduce transformation time, but Sucrase 3.35.1 needs corrections to preserve the behavior of existing code.
The patch fixes exports, optional TypeScript methods, optional calls on `super`, and JSX runtime selection.

## Correctness fixes

- **Explicit exports override star re-exports.** A module can re-export generated code and provide explicit replacements.
  Those replacements must win regardless of whether `export *` appears before or after them.
  The patch excludes explicit runtime names from star re-exports.
- **Exported variables retain their initialization behavior.** Comma-separated declarations must initialize in order and expose each value before subsequent initializers use it.
  The patch also preserves inferred function and class names, typed declarations, and mixed destructuring.
  Type annotations must not introduce runtime exports or confuse initializer detection, including function parameters and defaulted generic types.
- **Named function exports are available during circular imports.** The patch publishes direct `export function` declarations before source-level imports execute.
  This includes async functions and generators.
  Partial mocks can copy these exports before the module finishes initialization.
  The patch preserves writable data properties and does not overwrite replacements when evaluation reaches the declaration.
- **Optional TypeScript methods retain their bodies.** With class-field transforms enabled, Sucrase must distinguish an optional method from a field.
  The patch skips the TypeScript `?` marker before it classifies the member.
- **Optional calls on `super` skip missing methods.** Sucrase originally emits `super.method.bind(this)` before the optional-call helper can check for null or undefined.
  The patch moves binding into a guarded helper operation.
  A present method retains its receiver, arguments, and result. A missing method skips argument evaluation.
  The synchronous and asynchronous helpers perform binding without an additional callback or `await`.
- **JSX directives select the correct runtime.** Leading block-comment `@jsxImportSource` directives must select the requested runtime, including `@emotion/react`.
  Otherwise, the automatic JSX transform defaults to React instead of the runtime that the source requests.

## Performance role

This is a compatibility patch, not a separate compiler speed optimization.
The performance change is the switch from `ts-jest` to Sucrase.
The patch makes that switch usable without incorrect transformations.
It does not provide a measured speedup on its own.
The optional-super correction adds one helper operation only for affected calls. Ordinary chains retain their generated operations.

## Behavior and scope to preserve

- Type-only exports must not hide runtime values from star re-exports.
- Unrelated re-exports must remain live getters. Their descriptors must remain configurable for Jest spies.
- Generated helper names must not collide with source bindings or prototype-like export names.
- Optional type-only members must remain erased.
- Strings, JSX text, and line comments must not select a JSX runtime.

The patch changes the CommonJS `dist/` files used by the Jest adapter.
It does not change Sucrase's ESM distribution or add decorator support.
The adapter configuration remains in [jest.happy-dom.config.js](../jest.happy-dom.config.js).
The root [jest.config.js](../jest.config.js) retains JSDOM and `ts-jest` for baseline comparisons.

Function-export hoisting applies only to direct named declarations, not default exports or separate export clauses.
Generated JSX-runtime imports still execute before these export assignments.
The patch does not correct forward local exports such as `export { hook }; const { hook } = api;`.
Sucrase emits an immediate read before the binding exists.
The alerting folder-search module uses the equivalent `export const { hook } = api;` form to avoid this limitation.

The optional-super correction retains Sucrase's existing binding strategy and receiver detection. It does not provide full optional-chaining conformance.
For example, the existing receiver scan can miss `super[getKey()]?.()` when the key expression contains a call.
This patch does not correct that separate limitation or calls to methods with an overridden `.bind`.
If binding throws inside an asynchronous chain, the helper rejects. A surrounding catch can therefore run later than with eager binding.
This exception-timing difference does not affect successful binding or nullish short-circuiting.

## Regression tests

The focused suite is [jest-sucrase.test.cjs](../scripts/test-harness/compiler/jest-sucrase.test.cjs).
Its 90 tests exercise the installed compiler and configured adapter, not only generated source text.
They cover the patch corrections, `.mjs` imports and exports, Jest mock hoisting, and dynamic imports.
The 21 optional-super checks cover nullish methods, receivers, computed-key conversion, getters, parentheses, TypeScript calls, async evaluation, deletion, and the configured adapter.
Ten of these checks fail without the optional-super correction. The other checks protect existing behavior.
The async checks also confirm that successful binding adds no suspension or thenable conversion.
These harness tests run separately from source-test shards.
The `test:ci` command runs this suite before the Happy DOM source tests.
The broader `test:happy-dom:transformer` command continues to include this suite.

From the repository root, install dependencies with pnpm:

```sh
pnpm install --frozen-lockfile
```

pnpm applies the patch through `patchedDependencies` in [pnpm-workspace.yaml](../pnpm-workspace.yaml).
`npm install` does not apply this patch configuration.

Run the focused compiler suite:

```sh
pnpm run test:transformer
```

To run the same suite directly, use Node.js:

```sh
node --test scripts/test-harness/compiler/jest-sucrase.test.cjs
```

Run the broader compiler and benchmark harness checks:

```sh
npm run test:happy-dom:transformer
```

Run a source-test shard through the optimized configuration:

```sh
npm run test:bench:happy-dom -- --shard=5/8
```

The [benchmark guide](../scripts/jest-benchmark.md) describes roster replay and metrics for comparisons.

## When to remove the patch

An upstream version number alone is not evidence that the patch is unnecessary.
The replacement compiler must preserve all six corrections and the behavior listed above.

1. In a candidate upgrade, remove the patch registration and install the replacement compiler without this patch.
2. Run the focused compiler suite and the broader harness checks.
3. Run the affected source-test shards through the same adapter configuration.
4. Compare benchmark results with the same roster and machine conditions.
5. If the checks pass, remove obsolete patch files and update the dependency pins and lockfile.

If upstream fixes only part of the behavior, retain the remaining corrections and their tests.
