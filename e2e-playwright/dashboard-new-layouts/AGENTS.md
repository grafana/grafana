# dashboard-new-layouts E2E Tests — Agent Guide

## Purpose

This suite contains Playwright E2E tests for the V2 dashboard layout system. Tests use **page objects** to wrap raw selector chains behind user-intent methods. The full rationale is in [`_page_objects_strategy.md`](./_page_objects_strategy.md).

## Page Objects Reference

All page objects live in `page-objects/` and are re-exported from `page-objects/index.ts`. Every page object extends the abstract `PageObject` base class (`PageObject.ts`), which holds the shared `page`, `dashboardPage`, `selectors`, and `components` dependencies as `protected` fields.

| Class              | File                          | UI Region                                                              | Key Methods / Getters                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ----------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageObject`       | `PageObject.ts`               | _(abstract base — not used directly)_                                  | Shared constructor taking a `PageObjectArgs` object (`page`, `dashboardPage`, `selectors`, `components`)                                                                                                                                                                                                                                                                         |
| `Controls`         | `Controls.ts`                 | Top nav bar (edit, save, ...) and variable submenu                     | `enterEditMode()`, `exitEditMode()`; `variables` sub-object: `getLabel(variableLabel)`, `openDropdown(variableLabel)`, `getOption(optionLabel)`, `selectOption(variableLabel, optionLabel)`, `addFilter(variableLabel, [label, operator, value])`                                                                                                                                |
| `Sidebar`          | `sidebar/Sidebar.ts`          | Whole sidebar region (toolbar + open pane)                             | `.toolbar`, `.addOptions`, `.dashboardOptions`, `.panelOptions`, `.variableOptions`, `.contentOutline` sub-objects; `getContainer()`, `clickGoBackButton()`, `getDockToggle()`, `clickCloseButton()`, `clickDeleteButton({ confirm? })`                                                                                                                                          |
| `Toolbar`          | `sidebar/Toolbar.ts`          | Icon strip — accessed via `sidebar.toolbar`                            | `getButton(name)`, `clickButton(name)`, `getVisibilityToggle()`                                                                                                                                                                                                                                                                                                                  |
| `AddOptions`       | `sidebar/AddOptions.ts`       | "Add" pane (default pane on new dashboards) — via `sidebar.addOptions` | `clickNewPanelButton()`, `clickNewVariableButton()`                                                                                                                                                                                                                                                                                                                              |
| `ContentOutline`   | `sidebar/ContentOutline.ts`   | Content outline pane — via `sidebar.contentOutline`                    | `getTree()`, `clickItem(name)`, `toggleNode(name)`                                                                                                                                                                                                                                                                                                                               |
| `DashboardOptions` | `sidebar/DashboardOptions.ts` | Dashboard options pane — via `sidebar.dashboardOptions`                | `getTitleInput()`, `getDescriptionTextarea()`                                                                                                                                                                                                                                                                                                                                    |
| `PanelOptions`     | `sidebar/PanelOptions.ts`     | Panel options pane — via `sidebar.panelOptions`                        | `getTitleInput()`, `setTitle(title)`, `getDescriptionTextarea()`, `toggleTransparentBackground()`                                                                                                                                                                                                                                                                                |
| `VariableOptions`  | `sidebar/VariableOptions.ts`  | Variable edit pane — via `sidebar.variableOptions`                     | `selectVariableType(type)`, `setName(name)`, `setLabel(label)`, `getPreviewOptions()`; type-specific sub-objects: `datasource.selectType(dsType)`, `datasource.setNameFilter(filter)`, `groupby.selectDatasource(ds)`, `adhoc.selectDatasource(ds)`, `query.openEditor()`, `query.selectDatasource(ds)`, `query.setQuery(query)`, `query.runQuery()`, `query.clickApplyButton()` |
| `Panel`            | `Panel.ts`                    | A dashboard panel in the edit canvas                                   | `getContainerByTitle()`, `getHeaderByTitle()`, `selectByTitle(title \| titles[])`, `clickMenuItem(panelTitle, menuPath[])`                                                                                                                                                                                                                                                       |

> The show/hide visibility toggle is a **Toolbar** control (`sidebar.toolbar.getVisibilityToggle()`), even though its selector lives under `components.Sidebar.*`. `Toolbar.getButton(name)` resolves buttons by accessible name, scoped to the sidebar container.

> This table grows as specs are migrated — only methods needed by migrated specs exist.

### Base class & constructor

All page objects inherit from `PageObject`, which provides the shared constructor. It takes a single `PageObjectArgs` object:

```typescript
// page-objects/PageObject.ts
export interface PageObjectArgs {
  page: Page;
  dashboardPage: DashboardPage;
  selectors: E2ESelectorGroups;
  components: Components;
}

export abstract class PageObject {
  constructor({ page, dashboardPage, selectors, components }: PageObjectArgs) {
    // assigned to protected fields
  }
}
```

Simple page objects (e.g. `Controls`, `Toolbar`) inherit the constructor directly — no override needed. Page objects that compose sub-objects (e.g. `Sidebar`) declare `constructor(args: PageObjectArgs)`, call `super(args)`, and pass the same `args` to their children.

All four dependencies come from the Playwright test arguments:

```typescript
test('example', async ({ gotoDashboardPage, selectors, page, components }) => {
  const dashboardPage = await gotoDashboardPage({ uid: 'some-uid' });
  const controls = new Controls({ page, dashboardPage, selectors, components });
  // ...
});
```

## How to Write a New Test

1. **Identify which page objects you need.** Check the table above. If the interaction you need isn't covered, add the method to the appropriate page object — only what the new test requires.

2. **Scaffold the spec** following this structure:

```typescript
import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Sidebar } from './page-objects';

test.describe(
  'Feature name',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('describes the user-visible behavior', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: 'dashboard-uid' });

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

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

- **Locator getters** (e.g. `getTitleInput()`) return a Playwright `Locator` — for elements that specs assert on (or both act on and assert on). The test owns the assertion — never the page object.
- **Action methods** (e.g. `enterEditMode()`, `clickCloseButton()`) wrap interactions — multi-step flows or single clicks on act-only elements — and use `test.step()` so the HTML report shows named steps.
- **When a spec needs both**, pair them: the action method delegates to the getter (see `Toolbar.getButton()` / `clickButton()`).
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
3. For interactions (multi-step flows or single clicks on act-only elements), wrap in `test.step('Human-readable name', async () => { ... })`.
4. For elements the spec asserts on, return a `Locator` (getter pattern, no `test.step` needed).
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

**14 of 30 specs migrated.** Non-migrated specs are listed by descending selectors usage count (a rough proxy for migration effort). "Selectors usage count" is the number of times the spec accesses the `selectors` object (`selectors.components...`, `selectors.pages...`, etc.).

| Spec                                                  | Status      | Lines of code | Selectors usage count |
| ----------------------------------------------------- | ----------- | ------------- | --------------------- |
| `dashboards-title-description.spec.ts`                | Migrated    | —             | —                     |
| `dashboards-edit-panel-title-description.spec.ts`     | Migrated    | —             | —                     |
| `dashboards-edit-panel-transparent-bg.spec.ts`        | Migrated    | —             | —                     |
| `dashboard-mobile-sidebar.spec.ts`                    | Migrated    | —             | —                     |
| `dashboard-hide-sidebar.spec.ts`                      | Migrated    | —             | —                     |
| `dashboards-remove-panel.spec.ts`                     | Migrated    | —             | —                     |
| `dashboard-duplicate-panel.spec.ts`                   | Migrated    | —             | —                     |
| `dashboard-sidepane.spec.ts`                          | Migrated    | —             | —                     |
| `dashboard-outline.spec.ts`                           | Migrated    | —             | —                     |
| `dashboard-group-panels.spec.ts`                      | Not started | 918           | 224                   |
| `dashboards-repeats-tabs-layout.spec.ts`              | Not started | 482           | 74                    |
| `dashboards-repeats-custom-grid.spec.ts`              | Not started | 551           | 70                    |
| `dashboards-panel-layouts.spec.ts`                    | Not started | 425           | 70                    |
| `dashboards-repeats-auto-grid.spec.ts`                | Not started | 471           | 66                    |
| `dashboard-repeats-row-layout.spec.ts`                | Not started | 546           | 61                    |
| `dashboards-conditional-rendering.spec.ts`            | Not started | 308           | 53                    |
| `dashboards-add-panel.spec.ts`                        | Not started | 134           | 27                    |
| `dashboards-edit-variables.spec.ts`                   | Not started | 204           | 26                    |
| `dashboards-edit-custom-variables.spec.ts`            | Not started | 213           | 22                    |
| `dashboard-tabs-scroll.spec.ts`                       | Not started | 150           | 12                    |
| `dashboards-repeats-snapshots.spec.ts`                | Not started | 117           | 11                    |
| `dashboards-move-panel.spec.ts`                       | Not started | 120           | 9                     |
| `dashboard-conditional-rendering-load-change.spec.ts` | Not started | 459           | 8                     |
| `dashboards-edit-query-variables.spec.ts`             | Migrated    | —             | —                     |
| `dashboard-keybindings.spec.ts`                       | Migrated    | —             | —                     |
| `dashboards-edit-adhoc-variables.spec.ts`             | Migrated    | —             | —                     |
| `dashboards-edit-group-by-variables.spec.ts`          | Migrated    | —             | —                     |
| `dashboards-edit-datasource-variables.spec.ts`        | Migrated    | —             | —                     |
| `dashboard-url-syncing.spec.ts`                       | Not started | 128           | 3                     |
| `dashboard-tabs-drag-drop.spec.ts`                    | Not started | 75            | 2                     |

See [`_page_objects_strategy.md`](./_page_objects_strategy.md) for the full migration plan.
