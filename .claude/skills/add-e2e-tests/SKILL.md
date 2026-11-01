---
name: add-e2e-tests
description: Write or extend Grafana Playwright E2E specs to suite conventions (page objects / POMs, suite AGENTS.md, isolation, verification with --repeat-each=3). Use when adding e2e-playwright tests, migrating raw selectors to page objects, authoring dashboard-new-layouts or alerting-suite specs, or when an agent would otherwise copy unstable locator chains from unmigrated tests.
---

# Add e2e tests

Author Playwright E2E coverage the way this repo expects: **read the suite
`AGENTS.md` first**, prefer page objects / POMs over raw selectors, assert
user-visible behavior, and verify locally with repeated runs before claiming
done.

## Resolve the target

Interpret the argument to decide scope:

- **A suite directory** (e.g. `e2e-playwright/dashboard-new-layouts/`,
  `e2e-playwright/alerting-suite/`) → follow that suite’s `AGENTS.md`.
- **A spec path** → extend or create that file; match neighboring specs.
- **A feature description with no path** → pick the matching suite under
  `e2e-playwright/`; if unclear, ask — never blanket-generate across suites.
- **"current file" / open file** → that file’s suite conventions.

## Required reading (in order)

1. The suite’s **`AGENTS.md`** (directory-scoped). This is the source of truth
   for page objects, tags, auth, isolation, and verify commands.
2. Existing specs in that suite — match imports, `test.describe` tags, and
   setup/teardown style.
3. For dashboard V2 layouts only: `_page_objects_strategy.md` if you need the
   “why” behind page objects (do not dump it into the PR).

If the suite has no `AGENTS.md`, stop and ask — do not invent a parallel
convention.

## Workflow

1. **Read suite `AGENTS.md`** and list the page objects / POMs you will use.
2. **Extend a page object / POM** when the interaction is missing — add only
   what the new test needs; do not speculative-API the whole UI.
3. **Scaffold or extend the spec**:
   - Import from the suite’s page-object barrel / `pages/` POMs.
   - Title tests by **user-visible behavior**, not implementation mechanics.
   - Keep setup (API seed, `gotoDashboardPage`, auth) in the spec; keep
     UI actions behind page objects.
   - Prefer accessibility / suite-approved locators; reach for `getByTestId`
     only when the suite already does (or use the `add-e2e-selectors` skill
     if the product UI lacks a stable selector).
4. **Isolation**
   - Prefer per-test setup (`beforeEach`) over shared module state.
   - Unique resource names per invocation when creating server-side data
     (alerting suite: UUID suffix; never stable `testInfo.testId` alone).
5. **Verify** with the suite’s documented command. Default pattern when the
   suite AGENTS shows it:

```bash
yarn e2e:pw --project <suite-project> --reporter list --repeat-each=3 -- <spec-filename>
```

Do not claim the test is done after a single green run if the suite asks for
`--repeat-each=3`.

## Do / Don’t

| Do | Don’t |
|----|--------|
| Read suite `AGENTS.md` before writing | Copy raw selector chains from unmigrated specs |
| Use page objects / POMs for UI regions | Assert internal Redux/state; assert visible outcomes |
| Add the smallest POM method the test needs | Bulk-generate helpers “for later” |
| Scope locators to owning containers | Bare `page.getByRole(...)` across the whole page |
| Follow suite auth / tag conventions | Break `authenticate` setup with a file-path filter alone |

## Related skills

- **`add-e2e-selectors`** — when the product UI needs a versioned
  `@grafana/e2e-selectors` / `data-testid` before the E2E can be stable.
- **`panel-testing-strategy`** — for **unit** / panel viz tests under
  `public/app` and `packages/grafana-ui`, not Playwright suites.
