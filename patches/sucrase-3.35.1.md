# Sucrase 3.35.1 patch

Patch: [sucrase-3.35.1.patch](sucrase-3.35.1.patch)

## Root Jest configuration

The root [jest.config.js](../jest.config.js) uses `@sucrase/jest-plugin` 3.0.0 with Sucrase 3.35.1.
The test environment remains JSDOM.
The transform pattern remains `^.+\\.(ts|tsx|js|jsx|mjs)$`.
The adapter uses this configuration:

```js
{
  jsxRuntime: 'automatic',
  production: true,
  disableESTransforms: false,
  preserveDynamicImport: false,
}
```

The adapter converts imports and exports for CommonJS tests.
It also hoists Jest mocks and converts dynamic imports.
Sucrase removes TypeScript syntax but does not check types.

## Why this patch exists

Sucrase 3.35.1 needs five corrections to preserve the behavior of existing code.
The patch corrects exports, optional TypeScript methods, and JSX runtime selection.

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
- **JSX directives select the correct runtime.** Leading block-comment `@jsxImportSource` directives must select the requested runtime, including `@emotion/react`.
  Otherwise, the automatic JSX transform defaults to React instead of the runtime that the source requests.

## Patch scope

The patch changes the CommonJS `dist/` files that the Jest adapter uses.
It does not change the ESM distribution of Sucrase or add decorator support.

Function-export hoisting applies only to direct named declarations, not default exports or separate export clauses.
Generated JSX-runtime imports still execute before these export assignments.
The patch does not correct forward local exports such as `export { hook }; const { hook } = api;`.
Sucrase emits an immediate read before the binding exists.
The alerting folder-search module uses the equivalent `export const { hook } = api;` form to avoid this limitation.

The patch must preserve these behaviors:

- Type-only exports do not hide runtime values from star re-exports.
- Unrelated re-exports remain live getters. Their descriptors remain configurable for Jest spies.
- Generated helper names do not collide with source bindings.
- Prototype-like export names do not hide unrelated star exports.
- Sucrase removes optional type-only members.
- Strings, JSX text, and line comments do not select a JSX runtime.

## Installation

pnpm applies the patch through `patchedDependencies` in [pnpm-workspace.yaml](../pnpm-workspace.yaml).
`npm install` does not apply this patch configuration.

From the repository root, install dependencies with pnpm:

```sh
pnpm install --frozen-lockfile
```

## Regression checks

The focused suite is [scripts/jest-sucrase.test.cjs](../scripts/jest-sucrase.test.cjs).
It runs the installed compiler and the configured adapter, not a copy of the compiler implementation.
The tests check runtime behavior rather than only generated source text.
They cover the patch corrections, `.mjs` imports and exports, Jest mock hoisting, and dynamic imports.

The suite uses `node:test` and runs separately from Jest source tests.
It does not change Jest test discovery or source-test shard membership.
The `test:ci` command runs this suite before Jest.

From the repository root, run the focused suite:

```sh
pnpm run test:transformer
```

To run the same suite directly, use Node.js:

```sh
node --test scripts/jest-sucrase.test.cjs
```

Run type checks separately:

```sh
pnpm run typecheck
```

## Patch removal requirements

An upstream version number alone does not show that the patch is unnecessary.
The replacement compiler must preserve all five corrections and the behaviors in the patch scope.

1. In a candidate upgrade, remove the patch registration.
2. Install the replacement compiler without this patch.
3. Run `pnpm run test:transformer`.
4. Run the affected Jest source tests through the root configuration.
5. Run `pnpm run typecheck`.
6. If all checks pass, remove the obsolete patch files.
7. Update the dependency pins and lockfile.

If upstream fixes only part of the behavior, retain the remaining corrections and their tests.
