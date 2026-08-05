# dashboard-new-layouts E2E Tests — Agent Guide

## Purpose

This suite contains Playwright E2E tests for the V2 dashboard layout system. Tests use **page objects** to wrap raw selector chains behind user-intent methods. The full rationale is in [`_page_objects_strategy.md`](./_page_objects_strategy.md).

## Page Objects Reference

All page objects live in `page-objects/`. Only the top-level ones (`Controls`, `Sidebar`, `Panels`, `Rows`, `Tabs`, `Canvas`) are re-exported from `page-objects/index.ts` — import those in specs. Sidebar panes (`Toolbar`, `AddOptions`, `DashboardOptions`, `PanelOptions`, `RowOptions`, `TabOptions`, `VariableOptions`, `ContentOutline`) and shared sub-options (`ConditionalRenderingOptions`, `GridLayoutOptions`, `RepeatOptions` under `sidebar/shared/`) are not exported; reach them via `sidebar.*` (e.g. `sidebar.toolbar`, `sidebar.panelOptions.repeatOptions`). Every page object extends the abstract `PageObject` base class (`PageObject.ts`), which holds the shared `page`, `dashboardPage`, `selectors`, and `components` dependencies as `protected` fields.

| Class                         | File                                            | UI Region                                                                | Key Methods / Getters                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageObject`                  | `PageObject.ts`                                 | _(abstract base — not used directly)_                                    | Shared constructor taking a `PageObjectArgs` object (`page`, `dashboardPage`, `selectors`, `components`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `Controls`                    | `Controls.ts`                                   | Top nav bar (edit, save, timepicker, share, ...) and variable submenu    | `getContainer()`, `enterEditMode()`, `exitEditMode()`, `saveDashboard(title?)`, `clickBackToDashboard()`, `openControlsMenu()`, `openShareSnapshotDrawer()`; `timeRange` sub-object: `set(from, to)`, `selectPreset(presetLabel)`; `variables` sub-object: `getLabel(variableLabel)`, `getInput(variableLabel)`, `setValue(variableLabel, text)`, `getDropdownTrigger(variableLabel)`, `openDropdown(variableLabel)`, `getOption(optionLabel)`, `selectOption(variableLabel, optionLabel)`, `deselectOption(variableLabel, optionLabel)`, `addFilter(variableLabel, [label, operator, value])`                                                                                                 |
| `Sidebar`                     | `sidebar/Sidebar.ts`                            | Whole sidebar region (toolbar + open pane)                               | `.toolbar`, `.addOptions`, `.dashboardOptions`, `.panelOptions`, `.rowOptions`, `.tabOptions`, `.variableOptions`, `.contentOutline` sub-objects; `getContainer()`, `clickGoBackButton()`, `getDockToggle()`, `clickCloseButton()`, `clickCopyButton()`, `clickDuplicateButton()`, `clickDeleteButton({ confirm? })`                                                                                                                                                                                                                                                                                                                                                                           |
| `Toolbar`                     | `sidebar/Toolbar.ts`                            | Icon strip — accessed via `sidebar.toolbar`                              | `getButton(name)`, `clickButton(name)`, `getVisibilityToggle()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `AddOptions`                  | `sidebar/AddOptions.ts`                         | "Add" pane (default pane on new dashboards) — via `sidebar.addOptions`   | `clickNewPanelButton()`, `clickAddTabButton()`, `clickNewVariableButton()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `ContentOutline`              | `sidebar/ContentOutline.ts`                     | Content outline pane — via `sidebar.contentOutline`                      | `getTree()`, `clickItem(name)`, `toggleNode(name)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `DashboardOptions`            | `sidebar/DashboardOptions.ts`                   | Dashboard options pane — via `sidebar.dashboardOptions`                  | `.gridLayoutOptions`; `getTitleInput()`, `getDescriptionTextarea()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `PanelOptions`                | `sidebar/PanelOptions.ts`                       | Panel options pane — via `sidebar.panelOptions`                          | `.conditionalRenderingOptions`, `.repeatOptions`; `getTitleInput()`, `setTitle(title)`, `getDescriptionTextarea()`, `toggleTransparentBackground()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `RowOptions`                  | `sidebar/RowOptions.ts`                         | Row options pane — via `sidebar.rowOptions`                              | `.repeatOptions`; `setTitle(rowTitle)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `TabOptions`                  | `sidebar/TabOptions.ts`                         | Tab options pane — via `sidebar.tabOptions`                              | `.conditionalRenderingOptions`, `.repeatOptions`; `setTitle(tabTitle)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `ConditionalRenderingOptions` | `sidebar/shared/ConditionalRenderingOptions.ts` | Shared conditional rendering rules — via `*.conditionalRenderingOptions` | `selectVisibility('show' \| 'hide')`, `selectMatch('all' \| 'any')`, `addVariableRule(name, operator, value)`, `addTimeRangeRule(lessThan)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `GridLayoutOptions`           | `sidebar/shared/GridLayoutOptions.ts`           | Shared "layout" options group — via `*.gridLayoutOptions`                | `getLayoutType(layoutType)`, `switchLayout(layoutType, { confirm? })` with `layoutType: 'Auto' \| 'Custom' \| 'Rows' \| 'Tabs'`; auto grid sizing: `getMinColumnWidthSelect()`, `selectMinColumnWidth(option)` / `selectMinColumnWidth('Custom', customWidth)`, `getCustomMinColumnWidthInput()`, `clickClearCustomMinColumnWidth()`, `getMaxColumnsSelect()`, `selectMaxColumns(option)`, `getRowHeightSelect()`, `selectRowHeight(option)` / `selectRowHeight('Custom', customHeight)`, `getCustomRowHeightInput()`, `clickClearCustomRowHeight()`, `getFillScreenSwitch()`, `toggleFillScreen()`                                                                                            |
| `RepeatOptions`               | `sidebar/shared/RepeatOptions.ts`               | Shared repeat options — via `*.repeatOptions`                            | `repeatByVariable(variableName)`, `disableRepeatByVariable()`; constructor takes the options-group id (`'repeat-options'` for panels/tabs, `'dash-row-repeat'` for rows) — already wired by `PanelOptions`/`TabOptions`/`RowOptions`                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `VariableOptions`             | `sidebar/VariableOptions.ts`                    | Variable sidebar — via `sidebar.variableOptions`                         | `selectVariableType(type)`, `setName(name)`, `setLabel(label)`, `selectDisplay(displayLabel)`; type-specific sub-objects: `datasource.selectType(dsType)`, `datasource.setNameFilter(filter)`, `custom.openEditor()`, `custom.selectFormat(format)`, `custom.setValues(values)`, `custom.getPreviewOfValues()`, `custom.getPreviewTable()`, `custom.clickApplyButton()`, `groupby.selectDatasource(ds)`, `adhoc.selectDatasource(ds)`, `query.openEditor()`, `query.selectTargetDatasource(ds)`, `query.setTestDataQuery(query)`, `query.runQuery()`, `query.getPreviewOfValues()`, `query.clickApplyButton()`, `constant.setValue(value)`, `textbox.setValue(value)`, `interval.toggleAuto()` |
| `Panels`                      | `Panels.ts`                                     | The dashboard panels in the edit canvas                                  | `getPanels(title, scope?)`, `getPanel(title, scope?)` — whole panel `<section>`, string title only (exact testid match); `getHeaders(title?, scope?)`, `getHeader(title, scope?)` — header bar, string matches exactly, RegExp filters by text, no argument returns all headers; `getBodies()`, `selectByTitle(title \| RegExp \| Array<title \| RegExp>)`, `selectByIndex(index)`, `selectMenuItem(panelTitle, menuPath[])`                                                                                                                                                                                                                                                                   |
| `Rows`                        | `Rows.ts`                                       | A row of a rows layout in the dashboard canvas                           | `getTitle(rowTitle)`, `getContent(rowTitle)` — content wrapper (grid or nested tabs) right after the row header; `select(rowTitle)` — click the row title; `toggle(rowTitle)` — collapse an expanded row, expand a collapsed one                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `Tabs`                        | `Tabs.ts`                                       | Tab bar of a tabs layout (top-level or nested in a row)                  | `getTitle(tabTitle, scope?)` — pass `rows.getContent(rowTitle)` as `scope` to look up a tab inside a specific row; `getContent(tabTitle)` — the layout container holding the tab's content; `select(tabTitle)` — click the tab title                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `Canvas`                      | `Canvas.ts`                                     | Edit canvas add-actions strip (per grid, revealed on hover)              | `getContainer()`, `getAddPanelButton(panelsContainer?)`, `addPanel(panelsContainer?)`, `getAddTabButton(panelsContainer?)`, `addTab()`, `pasteTab()`, `ungroupTabs(panelsContainer?)`, `getAddRowButton(panelsContainer?)`, `addRow()`, `pasteRow()`, `ungroupRows(panelsContainer?)`, `groupPanels('row' \| 'tab', panelsContainer?)` — pass `panelsContainer` (e.g. `tabs.getContent(...)`, `rows.getContent(...)`) to target the add-actions strip of a nested grid                                                                                                                                                                                                                         |

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
- **Plural vs singular getters** (e.g. `getPanels()` / `getPanel()`): plural getters return every match — assert counts or narrow (`.first()`, `.nth()`) in the spec; singular getters return the first match.
- **Scoped lookups**: getters with a `scope?: Locator` parameter search inside that container — pass `rows.getContent(...)` or `tabs.getContent(...)` to look up elements in a specific row or tab.
- **No waits or retries inside page objects** unless the pre-refactor code had them. Keep `toPass()` retries, drag-and-drop, scroll logic, and `boundingBox()` in the spec or in `utils.ts`.

### Selector scoping

- **Scope lookups to the owning container.** A bare `page.getByRole(...)` searches the whole page and can match an unrelated element with the same role and name — if not today, then after an unrelated UI change. Elements that belong to a region with a page object must be looked up through that region's container: e.g. radio buttons in the sidebar are `sidebar.getContainer().getByRole('radio', { name: '...' })`, the same way `Toolbar.getButton()` scopes button names to `Sidebar.container`. Inside a page object, chain from the container selector (`this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.container).getByRole(...)`).
- **Portalled UI is the only exception.** Select/Combobox option lists, modals, tooltips, and toasts render in a portal at the document root, outside their logical parent, so they cannot be scoped to it. Anchor them to the portal's own root instead: `page.getByRole('listbox').getByRole('option', { name })` (see `RepeatOptions`), or `page.getByRole('dialog', { name: 'Delete panel?' })`. A bare `page.getByRole('option', ...)` with no anchor is still too broad.

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

**31 of 31 specs migrated — the migration is complete.** No spec accesses the `selectors` object directly anymore, beyond the one-off assertions allowed by the conventions above.

| Spec                                                  | Status   | Lines of code | Selectors usage count |
| ----------------------------------------------------- | -------- | ------------- | --------------------- |
| `dashboard-group-panels.spec.ts`                      | Migrated | —             | —                     |
| `dashboards-auto-grid-resize-intercept.spec.ts`       | Migrated | —             | —                     |
| `dashboards-panel-layouts.spec.ts`                    | Migrated | —             | —                     |
| `dashboard-repeats-row-layout.spec.ts`                | Migrated | —             | —                     |
| `dashboards-repeats-tabs-layout.spec.ts`              | Migrated | —             | —                     |
| `dashboards-repeats-custom-grid.spec.ts`              | Migrated | —             | —                     |
| `dashboards-repeats-auto-grid.spec.ts`                | Migrated | —             | —                     |
| `dashboards-title-description.spec.ts`                | Migrated | —             | —                     |
| `dashboards-edit-panel-title-description.spec.ts`     | Migrated | —             | —                     |
| `dashboards-edit-panel-transparent-bg.spec.ts`        | Migrated | —             | —                     |
| `dashboard-mobile-sidebar.spec.ts`                    | Migrated | —             | —                     |
| `dashboard-hide-sidebar.spec.ts`                      | Migrated | —             | —                     |
| `dashboards-remove-panel.spec.ts`                     | Migrated | —             | —                     |
| `dashboard-duplicate-panel.spec.ts`                   | Migrated | —             | —                     |
| `dashboard-sidepane.spec.ts`                          | Migrated | —             | —                     |
| `dashboard-outline.spec.ts`                           | Migrated | —             | —                     |
| `dashboards-conditional-rendering.spec.ts`            | Migrated | —             | —                     |
| `dashboards-add-panel.spec.ts`                        | Migrated | —             | —                     |
| `dashboards-edit-variables.spec.ts`                   | Migrated | —             | —                     |
| `dashboard-tabs-scroll.spec.ts`                       | Migrated | —             | —                     |
| `dashboards-repeats-snapshots.spec.ts`                | Migrated | —             | —                     |
| `dashboards-move-panel.spec.ts`                       | Migrated | —             | —                     |
| `dashboard-conditional-rendering-load-change.spec.ts` | Migrated | —             | —                     |
| `dashboards-edit-custom-variables.spec.ts`            | Migrated | —             | —                     |
| `dashboards-edit-query-variables.spec.ts`             | Migrated | —             | —                     |
| `dashboard-keybindings.spec.ts`                       | Migrated | —             | —                     |
| `dashboards-edit-adhoc-variables.spec.ts`             | Migrated | —             | —                     |
| `dashboards-edit-group-by-variables.spec.ts`          | Migrated | —             | —                     |
| `dashboards-edit-datasource-variables.spec.ts`        | Migrated | —             | —                     |
| `dashboard-url-syncing.spec.ts`                       | Migrated | —             | —                     |
| `dashboard-tabs-drag-drop.spec.ts`                    | Migrated | —             | —                     |

See [`_page_objects_strategy.md`](./_page_objects_strategy.md) for the full migration plan.
