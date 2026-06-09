# dashboard-new-layouts E2E Tests — Agent Guide

## Purpose

This suite contains Playwright E2E tests for the V2 dashboard layout system. Tests use **page objects** to wrap raw selector chains behind user-intent methods. The full rationale is in [`_page_objects_strategy.md`](./_page_objects_strategy.md).

## Page Objects Reference

All page objects live in `page-objects/` and are re-exported from `page-objects/index.ts`. Every page object extends the abstract `PageObject` base class (`PageObject.ts`), which holds the shared `page`, `dashboardPage`, and `selectors` dependencies as `protected` fields.

| Class              | File                          | UI Region                                               | Key Methods / Getters                                                                                                                      |
| ------------------ | ----------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `PageObject`       | `PageObject.ts`               | _(abstract base — not used directly)_                   | Shared constructor (`page`, `dashboardPage`, `selectors`)                                                                                  |
| `Controls`         | `Controls.ts`                 | Top nav bar (edit, save, ...)                           | `enterEditMode()`                                                                                                                          |
| `Sidebar`          | `sidebar/Sidebar.ts`          | Whole sidebar region (toolbar + open pane)              | `.toolbar`, `.dashboardOptions`, `.panelOptions` sub-objects; `getContainer()`, `getGoBackButton()`, `getDockToggle()`, `getCloseButton()` |
| `Toolbar`          | `sidebar/Toolbar.ts`          | Icon strip — accessed via `sidebar.toolbar`             | `getButton(name)`, `clickButton(name)`, `getVisibilityToggle()`                                                                            |
| `DashboardOptions` | `sidebar/DashboardOptions.ts` | Dashboard options pane — via `sidebar.dashboardOptions` | `getTitleInput()`, `getDescriptionTextarea()`                                                                                              |
| `PanelOptions`     | `sidebar/PanelOptions.ts`     | Panel options pane — via `sidebar.panelOptions`         | `getTitleInput()`, `getDescriptionTextarea()`, `toggleTransparentBackground()`                                                             |
| `Panel`            | `Panel.ts`                    | A dashboard panel in the edit canvas                    | `getContainerByTitle()`, `getHeaderByTitle()`, `selectByTitle()`, `deselectAll()`                                                          |

> The show/hide visibility toggle is a **Toolbar** control (`sidebar.toolbar.getVisibilityToggle()`), even though its selector lives under `components.Sidebar.*`. `Toolbar.getButton(name)` resolves buttons by accessible name, scoped to the sidebar container.

> This table grows as specs are migrated — only methods needed by migrated specs exist.

### Base class & constructor

All page objects inherit from `PageObject`, which provides the shared constructor:

```typescript
// page-objects/PageObject.ts
export abstract class PageObject {
  constructor(
    protected page: Page,
    protected dashboardPage: DashboardPage,
    protected selectors: E2ESelectorGroups
  ) {}
}
```

Simple page objects (e.g. `Controls`, `Toolbar`) inherit the constructor directly — no override needed. Page objects that compose sub-objects (e.g. `Sidebar`) call `super(page, dashboardPage, selectors)` and initialize their children.

All three dependencies come from the Playwright test arguments:

```typescript
test('example', async ({ gotoDashboardPage, selectors, page }) => {
  const dashboardPage = await gotoDashboardPage({ uid: 'some-uid' });
  const controls = new Controls(page, dashboardPage, selectors);
  // ...
});
```

## How to Write a New Test

1. **Identify which page objects you need.** Check the table above. If the interaction you need isn't covered, add the method to the appropriate page object — only what the new test requires.

2. **Scaffold the spec** following this structure:

```typescript
import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Sidebar } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
});

test.describe(
  'Feature name',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('describes the user-visible behavior', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: 'dashboard-uid' });

      const controls = new Controls(page, dashboardPage, selectors);
      const sidebar = new Sidebar(page, dashboardPage, selectors);

      await controls.enterEditMode();
      // ... test body using page objects (the toolbar is reached via sidebar.toolbar)
    });
  }
);
```

1. **Verify locally:**

```bash
yarn e2e:pw --project dashboard-new-layouts --reporter list --repeat-each=3 -- <spec-filename>
```

## Conventions

### Page objects

- **Locator getters** (e.g. `getTitleInput()`) return a Playwright `Locator`. The test owns the assertion — never the page object.
- **Action methods** (e.g. `enterEditMode()`) wrap multi-step interactions and use `test.step()` so the HTML report shows named steps.
- **No speculative methods.** Only add methods needed by the spec being migrated.
- **No waits or retries inside page objects** unless the pre-refactor code had them. Keep `toPass()` retries, drag-and-drop, scroll logic, and `boundingBox()` in the spec or in `utils.ts`.

### Specs

- **One raw `getByGrafanaSelector` is allowed** for one-off assertions that aren't reusable interactions (e.g. a breadcrumb check).
- **Timing-sensitive mechanics stay inline** — `toPass()`, `mouse` sequences, `page.evaluate()`.
- **Test setup stays in the spec** — API calls, dashboard provisioning, navigation via `gotoDashboardPage()`.
- **Each spec is fully migrated or untouched.** No file should mix page-object calls and raw selectors for the same UI region.

### Adding a method to a page object

1. Find the raw selector chain in the spec you're migrating.
2. Copy it into the appropriate page object class — mechanical extraction, no rewrites. New page objects must extend `PageObject` from `PageObject.ts`.
3. For multi-step interactions, wrap in `test.step('Human-readable name', async () => { ... })`.
4. For single-element access, return a `Locator` (getter pattern, no `test.step` needed).
5. Run `--repeat-each=3` on the migrated spec.

## Canonical Example

`dashboards-title-description.spec.ts` — the seed spec demonstrating the full pattern:

```typescript
await controls.enterEditMode();
await sidebar.toolbar.clickButton('Options');

const titleInput = sidebar.dashboardOptions.getTitleInput();
await expect(titleInput).toHaveValue('Annotation filtering');

const newTitle = 'New dashboard title';
await titleInput.fill(newTitle);
await expect(titleInput).toHaveValue(newTitle);
```

## Migration Status

| Spec                                              | Status      |
| ------------------------------------------------- | ----------- |
| `dashboards-title-description.spec.ts`            | Migrated    |
| `dashboards-edit-panel-title-description.spec.ts` | Migrated    |
| `dashboards-edit-panel-transparent-bg.spec.ts`    | Migrated    |
| `dashboard-mobile-sidebar.spec.ts`                | Migrated    |
| `dashboard-hide-sidebar.spec.ts`                  | Migrated    |
| 21 remaining specs                                | Not started |

See [`_page_objects_strategy.md`](./_page_objects_strategy.md) for the full migration plan.
