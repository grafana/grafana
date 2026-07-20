# Contributing to @grafana/o11y-ds-frontend

This package contains shared UI components and utilities used by observability datasource plugins (Tempo, Zipkin, Jaeger and Grafana Explore)
inside the Grafana monorepo.

For general contribution guidelines, see the [root CONTRIBUTING.md](../../CONTRIBUTING.md) and the [developer guide](../../contribute/developer-guide.md).

## Development

All commands are run from the **monorepo root**, not this directory.

**Build the package:**

```bash
yarn workspace @grafana/o11y-ds-frontend build
```

**Run tests:**

```bash
yarn workspace @grafana/o11y-ds-frontend test
```

**Type-check:**

```bash
yarn workspace @grafana/o11y-ds-frontend typecheck
```

## Adding or changing code

- Every new utility or component must have unit tests. Use Jest and `@testing-library/react` for component tests (see existing `*.test.ts` / `*.test.tsx` files as examples).
- Exports must be added to `src/index.ts` to be part of the public API.

## Releases

Releases are **fully automatic**. This package is published to npm as part of the standard Grafana release process — the same pipeline that publishes `@grafana/ui`, `@grafana/data`, and other packages in this monorepo. You do not need to bump the version, tag a release, or run any publish command manually.

If you are curious about how the release pipeline works, search the `.github/workflows/` directory for `release-build`.
