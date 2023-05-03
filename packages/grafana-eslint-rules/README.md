# Grafana ESLint Rules

This package contains custom eslint rules for use within the Grafana codebase only. They're extremley specific to our codebase, and are of little use to anyone else. They're not published to NPM, and are consumed through the Yarn workspace.

## Rules

### `@grafana/no-aria-label-selectors`

Require aria-label JSX properties to not include selectors from the `@grafana/e2e-selectors` package.

Previously we hijacked the aria-label property to use as E2E selectors as an attempt to "improve accessibility" while making this easier for testing. However, this lead to many elements having poor, verbose, and unnecessary labels.

Now, we prefer using data-testid for E2E selectors.
