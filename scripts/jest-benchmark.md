# Jest shard benchmarks

## Happy DOM with patched Sucrase

The existing `test:bench:happy-dom` script selects `jest.happy-dom.config.js`. This configuration extends the root Jest configuration and replaces its environment and transformer.

The benchmark uses four workers and a fresh private Jest cache. It preserves the root resolver, setup files, mocks, snapshots, console enforcement, and worker recycling.

The benchmark includes existing split-suite companions. Explicit per-test environment directives remain effective, including the documented jsdom exceptions. Sucrase remains the transformer for those exceptions.

Normal Jest commands and `test:bench:jsdom` still use the root ts-jest configuration.

### Install

Use the Node and pnpm versions specified by the repository.

If the patch does not include a regenerated lockfile, install with:

```sh
pnpm install --no-frozen-lockfile
```

This command regenerates `pnpm-lock.yaml` and applies the registered package patches. Package downloads and approved installation scripts require network access and disk space.

Use pnpm for installation. `npm install` does not apply the patches registered in `pnpm-workspace.yaml`. Using `npm run` for the benchmark commands is supported.

### Validate the transformer

Run the benchmark-runner and compiler regression tests:

```sh
npm run test:happy-dom:transformer
```

The compiler tests require the installed Sucrase package. They do not silently skip when it is absent.

### Run shards 1 and 5

Run each command separately:

```sh
npm run test:bench:happy-dom -- --shard=1/8
npm run test:bench:happy-dom -- --shard=5/8
```

Without `--shard`, the existing default remains `5/8`.

To inspect the selection without running tests, use:

```sh
npm run test:bench:happy-dom -- --shard=1/8 --listTests
npm run test:bench:happy-dom -- --shard=5/8 --listTests
```

The benchmark prints the selected-suite count and selection hash. Test failures retain a nonzero exit code. Cleanup removes only the benchmark's private cache.

## Sucrase patch

The root development dependencies pin `@sucrase/jest-plugin` to 3.0.0 and `sucrase` to 3.35.1. pnpm applies `patches/sucrase-3.35.1.patch` through `patchedDependencies`.

The patch combines four corrections:

- Explicit runtime exports take precedence over star re-exports, regardless of declaration order.
- Comma-separated exported variables retain their initializers and inferred function/class names.
- Optional TypeScript class methods retain their bodies with class-field transforms enabled.
- Leading block-comment `@jsxImportSource` directives select the JSX runtime, including Emotion.

Nonexcluded re-exports retain configurable live getters for Jest spies. No global property-descriptor patch is necessary.

The Jest configuration enables Sucrase's ES transforms to preserve assignment-style class fields. It uses automatic production JSX and transforms dynamic imports to CommonJS.

The package patch targets the CommonJS distribution used by the Jest adapter. It does not modify Sucrase's ESM distribution or add decorator transpilation.

The shard-1 compatibility audit found no additional Sucrase-specific failure among the executable tests. Six suites remained blocked by unavailable packages in the audit installation.

These commands do not suppress existing test failures or supply generated backend migration fixtures. Shard 5 and a complete dependency installation can expose additional compatibility gaps.
