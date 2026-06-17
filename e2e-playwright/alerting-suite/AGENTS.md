# Alerting e2e tests — agent guide

This guide documents conventions for Playwright e2e tests under
`e2e-playwright/alerting-suite/`. Follow it when adding or modifying specs in this
directory.

## Test isolation and parallelism

Playwright's global config sets `fullyParallel: true`, which distributes individual
tests (not just files) across workers. The implications:

- `beforeAll` / `afterAll` run **once per worker**, not once per file. With shared
  module-scoped state, every worker that picks up a test runs its own setup, creating
  duplicate resources (and resulting in strict-mode locator violations or 409s).
- Prefer `beforeEach` / `afterEach`. Each test owns its own resources, no shared
  module-scoped state to reason about, and parallel workers can't collide.
- Reach for `test.describe.configure({ mode: 'serial' })` only when shared state is
  unavoidable. It pins all tests in the file to a single worker, sacrificing
  parallelism for setup-cost reuse.

## Unique resource names

When the test creates server-side resources (folders, groups, rules), the name needs
to be unique **per invocation** — not per test definition.

- Use `crypto.randomUUID().slice(0, 8)` (or similar) generated inside `beforeEach`.
  Each run produces a fresh name; parallel workers can't collide; orphans from a
  crashed previous run don't accumulate under the same title.
- Do **not** use `testInfo.testId` — it's stable across runs, so the same orphaned
  name keeps reappearing. Same applies to fixed names or `Date.now()` at module
  scope.
- Do **not** add pre-create cleanup loops to compensate for stable names. That's a
  workaround for using the wrong identifier.

## Cleanup via cascade

Each test owns one folder, created in `beforeEach`. Everything the test seeds lives
inside that folder. The `afterEach` deletes the folder with
`?forceDeleteRules=true`, which cascade-deletes all rule groups, rules, and seeded
data within.

- Don't add per-resource cleanup hooks when the parent folder cascade covers it.
- The k8s `alertrule` API stores the folder reference under
  `metadata.annotations['grafana.app/folder']` — those rules are also caught by
  the folder cascade.
- One DELETE call per test is faster and partial-failure-safe vs. per-group
  cleanup.

## Realistic test data

Use names that look like real alerting entities. Examples in this suite:

- Folders: `Infrastructure alerts <suffix>`
- Groups: `disk-alerts`, `infra-monitoring`, `platform-alerts`
- Rules: `High CPU usage`, `Disk space low`, `Memory pressure`, `Node load average`
- Seeded placeholders: `Node disk read latency`, `Pod restart rate`, `HTTP error rate`

Avoid `E2E ...`, `e2e-seed-...`, or other test-betraying prefixes — they bleed into
the UI, the API, and any screenshots/traces, making the test data look fake even
when it covers real flows.

## Page Object Models (POMs)

Encapsulate UI interactions in class-based POMs under `pages/`. The existing
`AlertRuleEditPage` and `AlertRuleViewPage` demonstrate the pattern. Add new POMs
for new pages or for substantial subviews; do not inline complex locator logic in
specs.

### Structure

- One class per page or distinct view (`AlertRuleEditPage`, `AlertRuleViewPage`,
  `ContactPointsPage`, `SilencesListPage`, …).
- Constructor takes the Playwright `Page` and stashes it as a private field.
- High-level actions are public async methods that describe user intent
  (`setEvaluationInterval`, `useExistingGroup`, `setManualRouting`) — not raw
  click/fill operations.
- Locators that tests assert against (e.g. `nameHeading`, `evaluationIntervalText`)
  are public getters returning `Locator`. Locators that are only used internally
  are `protected` or `private`.

### Locator strategy

- Prefer accessibility queries: `getByRole`, `getByLabel`, `getByText`.
- Reach for `getByTestId` only when the component has no stable accessible name.
  If you find yourself adding a testid, consider whether the underlying component
  should expose an accessible name instead.
- When a label double-matches because of `<Field>` description-bleed, target the
  input by id or use a more specific role query rather than papering over it with
  `.first()`.
- For tree/list items that can appear in multiple sections (breadcrumbs vs.
  sidebar vs. metadata strip), scope the query (`getByRole('group', { name })`
  then drill in).

### Documentation

- Comment non-obvious locator choices inline — particularly when you've worked
  around a UI quirk (e.g. label double-match, dropdown race, hidden-when-flag-off
  inputs). Skip JSDoc for self-explanatory methods/getters; the comments should
  earn their place by explaining _why_ a selector looks the way it does.

## Authentication

All tests use the `request` and `page` fixtures from `@grafana/plugin-e2e`. Auth
is wired up at the project level in `playwright.config.ts` via `withAuth(...)`,
which adds the `authenticate` setup project as a dependency and points the test at
a saved storage state file.

**Gotcha:** Playwright applies CLI file filters to dependency projects too. So
`yarn e2e:pw --project=alerting e2e-playwright/alerting-suite/foo.spec.ts` will
also filter the `authenticate` project's `auth.setup.js`, find no matches, and
skip generating the storage state — every API call then 403s.

Workarounds:

1. Run the setup project explicitly first:
   ```sh
   yarn e2e:pw --project=authenticate
   yarn e2e:pw --project=alerting --reporter=line e2e-playwright/alerting-suite/foo.spec.ts
   ```
2. Use `--grep` instead of a file path — title filters don't break dependency
   projects:
   ```sh
   yarn e2e:pw --project=alerting --reporter=line --grep "your test title"
   ```

## SQLite / dev-env caveats

The e2e Grafana instance uses SQLite with a small `max_open_conn` cap
(`scripts/grafana-server/custom.ini`). Under sustained parallel writes you'll
see flakes like `SQLITE_BUSY`, `sqlstore.max-retries-reached`, or 403s from
request handlers giving up. If the test logic looks correct, suspect the
connection pool before suspecting the test.

## File organization

Top-down: imports, config, shared state, hooks, `test.describe` blocks, then
helpers at the bottom. TypeScript hoists function declarations, so helpers can
be referenced from earlier test bodies.

## Spec authoring

Title tests by behavior, not mechanics. Push complex locator/action logic into
POM methods. Assert visible outcomes (rendered values, breadcrumbs, errors),
not internal state.
