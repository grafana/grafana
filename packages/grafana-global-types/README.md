# @types/grafana-globals

Ambient TypeScript declarations for the Grafana frontend monorepo. Contains ambient type declarations shared across the entire project — global window properties, asset imports, and third-party library augmentations.

## What's in here

| File                      | Purpose                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `window.d.ts`             | Grafana-specific properties on the `Window` global (`grafanaBootData`, `__grafanaSceneContext`, etc.) |
| `images.d.ts`             | Module declarations for asset imports (`*.svg`, `*.png`, `*.jpg`)                                     |
| `intl.d.ts`               | Polyfill types for `Intl.DurationFormat` (from `@formatjs/intl-durationformat`)                       |
| `jquery.d.ts`             | Augments `JQueryStatic` with the Flot charting plugin (`$.plot`)                                      |
| `react-table-config.d.ts` | Merges react-table v7 plugin interfaces into the core `TableOptions`, `TableInstance`, etc. types     |

`index.d.ts` is the entry point — it pulls in all of the above via triple-slash references, plus re-exports `@testing-library/jest-dom` matchers into the global Jest namespace.

## How it's included

The package name (`@types/grafana-globals`) follows the `@types/*` convention so TypeScript resolves it automatically. Alternatively it can be listed in `tsconfig.json`:

```json
// tsconfig.json
{
  "compilerOptions": {
    "types": ["grafana-globals", ...]
  }
}
```

Adding a new ambient declaration here makes it available everywhere in the project without any import. Use this sparingly — prefer explicit imports for anything that isn't truly ambient (i.e. global augmentations or module wildcards).

## Adding declarations

1. Create a new `.d.ts` file in this directory.
2. Add a `/// <reference path="./your-file.d.ts" />` line to `index.d.ts`.
