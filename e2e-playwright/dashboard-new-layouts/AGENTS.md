# dashboard-new-layouts E2E Tests — Agent Guide

## Purpose

This suite contains Playwright E2E tests for the V2 dashboard layout system. Tests use **page objects** to wrap raw selector chains behind user-intent methods, so specs read like user stories (`controls.enterEditMode()`) instead of selector chains, each interaction has exactly one implementation, and selector changes touch one file instead of every spec.

## Page Objects Reference

All page objects live in `page-objects/`. Specs never construct them: the top-level ones (`Controls`, `Sidebar`, `Panels`, `Rows`, `Tabs`, `Canvas`) are exposed as **Playwright fixtures** by `fixtures.ts` — destructure them from the test arguments (`async ({ controls, sidebar }) => ...`). Import page-object classes in a spec only when a helper signature needs the type (`import { type Sidebar } from './page-objects'`). Sidebar panes (`Toolbar`, `AddOptions`, `DashboardOptions`, `PanelOptions`, `RowOptions`, `TabOptions`, `GroupOptions`, `VariableOptions`, `ContentOutline`) and shared sub-options (`ConditionalRenderingOptions`, `GridLayoutOptions`, `RepeatOptions` under `sidebar/shared/`) are reached via `sidebar.*` (e.g. `sidebar.toolbar`, `sidebar.panelOptions.repeatOptions`). Every page object extends the abstract `PageObject` base class (`PageObject.ts`), which holds the shared `page`, `getByGrafanaSelector`, `selectors`, and `components` dependencies as `protected` fields.

| Class                         | File                                            | UI Region                                                                 | Key Methods / Getters                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageObject`                  | `PageObject.ts`                                 | _(abstract base — not used directly)_                                     | Shared constructor taking a `PageObjectArgs` object (`page`, `getByGrafanaSelector`, `selectors`, `components`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `Controls`                    | `Controls.ts`                                   | Top nav bar (edit, save, timepicker, share, ...) and variable submenu     | `getContainer()`, `enterEditMode()`, `exitEditMode()`, `saveDashboard(title?)`, `clickBackToDashboard()`, `openControlsMenu()`, `openShareSnapshotDrawer()`; `timeRange` sub-object: `set(from, to)`, `selectPreset(presetLabel)`; `variables` sub-object: `getLabel(variableLabel)`, `getInput(variableLabel)`, `setValue(variableLabel, text)`, `getDropdownTrigger(variableLabel)`, `openDropdown(variableLabel)`, `getOption(optionLabel)`, `selectOption(variableLabel, optionLabel)`, `deselectOption(variableLabel, optionLabel)`, `addFilter(variableLabel, [label, operator, value])`                                                                                                 |
| `Sidebar`                     | `sidebar/Sidebar.ts`                            | Whole sidebar region (toolbar + open pane)                                | `.toolbar`, `.addOptions`, `.dashboardOptions`, `.panelOptions`, `.rowOptions`, `.tabOptions`, `.groupOptions`, `.variableOptions`, `.contentOutline` sub-objects; `getContainer()`, `clickGoBackButton()`, `getDockToggle()`, `clickCloseButton()`, `clickCopyButton()`, `clickDuplicateButton()`, `clickDeleteButton({ confirm? })`                                                                                                                                                                                                                                                                                                                                                          |
| `Toolbar`                     | `sidebar/Toolbar.ts`                            | Icon strip — accessed via `sidebar.toolbar`                               | `getButton(name)`, `clickButton(name)`, `getVisibilityToggle()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `AddOptions`                  | `sidebar/AddOptions.ts`                         | "Add" pane (default pane on new dashboards) — via `sidebar.addOptions`    | `clickNewPanelButton()`, `clickAddTabButton()`, `clickNewVariableButton()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `ContentOutline`              | `sidebar/ContentOutline.ts`                     | Content outline pane — via `sidebar.contentOutline`                       | `getTree()`, `clickItem(name)`, `toggleNode(name)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `DashboardOptions`            | `sidebar/DashboardOptions.ts`                   | Dashboard options pane — via `sidebar.dashboardOptions`                   | `.gridLayoutOptions`; `getTitleInput()`, `getDescriptionTextarea()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `PanelOptions`                | `sidebar/PanelOptions.ts`                       | Panel options pane — via `sidebar.panelOptions`                           | `.conditionalRenderingOptions`, `.repeatOptions`; `getTitleInput()`, `setTitle(title)`, `getDescriptionTextarea()`, `toggleTransparentBackground()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `RowOptions`                  | `sidebar/RowOptions.ts`                         | Row options pane — via `sidebar.rowOptions`                               | `.repeatOptions`; `setTitle(rowTitle)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `TabOptions`                  | `sidebar/TabOptions.ts`                         | Tab options pane — via `sidebar.tabOptions`                               | `.conditionalRenderingOptions`, `.repeatOptions`; `setTitle(tabTitle)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `GroupOptions`                | `sidebar/GroupOptions.ts`                       | "Group" category shown for a multi-selection — via `sidebar.groupOptions` | `getGroupIntoButton('row' \| 'tab')`, `clickGroupIntoButton('row' \| 'tab')`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ConditionalRenderingOptions` | `sidebar/shared/ConditionalRenderingOptions.ts` | Shared conditional rendering rules — via `*.conditionalRenderingOptions`  | `selectVisibility('show' \| 'hide')`, `selectMatchType('all' \| 'any')`, `addVariableRule(name, operator, value)`, `addTimeRangeRule(optionLabel)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `GridLayoutOptions`           | `sidebar/shared/GridLayoutOptions.ts`           | Shared "layout" options group — via `*.gridLayoutOptions`                 | `getLayoutType(layoutType)`, `switchLayout(layoutType, { confirm? })` with `layoutType: 'Auto' \| 'Custom' \| 'Rows' \| 'Tabs'`; auto grid sizing: `getMinColumnWidthSelect()`, `selectMinColumnWidth(option)` / `selectMinColumnWidth('Custom', customWidth)`, `getCustomMinColumnWidthInput()`, `clickClearCustomMinColumnWidth()`, `getMaxColumnsSelect()`, `selectMaxColumns(option)`, `getRowHeightSelect()`, `selectRowHeight(option)` / `selectRowHeight('Custom', customHeight)`, `getCustomRowHeightInput()`, `clickClearCustomRowHeight()`, `getFillScreenSwitch()`, `toggleFillScreen()`                                                                                            |
| `RepeatOptions`               | `sidebar/shared/RepeatOptions.ts`               | Shared repeat options — via `*.repeatOptions`                             | `repeatByVariable(variableName)`, `disableRepeatByVariable()`; constructor takes the options-group id (`'repeat-options'` for panels/tabs, `'dash-row-repeat'` for rows) — already wired by `PanelOptions`/`TabOptions`/`RowOptions`                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `VariableOptions`             | `sidebar/VariableOptions.ts`                    | Variable sidebar — via `sidebar.variableOptions`                          | `selectVariableType(type)`, `setName(name)`, `setLabel(label)`, `selectDisplay(displayLabel)`; type-specific sub-objects: `datasource.selectType(dsType)`, `datasource.setNameFilter(filter)`, `custom.openEditor()`, `custom.selectFormat(format)`, `custom.setValues(values)`, `custom.getPreviewOfValues()`, `custom.getPreviewTable()`, `custom.clickApplyButton()`, `groupby.selectDatasource(ds)`, `adhoc.selectDatasource(ds)`, `query.openEditor()`, `query.selectTargetDatasource(ds)`, `query.setTestDataQuery(query)`, `query.runQuery()`, `query.getPreviewOfValues()`, `query.clickApplyButton()`, `constant.setValue(value)`, `textbox.setValue(value)`, `interval.toggleAuto()` |
| `Panels`                      | `Panels.ts`                                     | The dashboard panels in the edit canvas                                   | `getPanels(title, scope?)`, `getPanel(title, scope?)` — whole panel `<section>`, string title only (exact testid match); `getHeaders(title?, scope?)`, `getHeader(title, scope?)` — header bar, string matches exactly, RegExp filters by text, no argument returns all headers; `getBodies()`, `selectByTitle(title \| RegExp \| Array<title \| RegExp>)`, `selectByIndex(index \| index[])`, `selectMenuItem(panelTitle, menuPath[])`                                                                                                                                                                                                                                                        |
| `Rows`                        | `Rows.ts`                                       | A row of a rows layout in the dashboard canvas                            | `getTitle(rowTitle)`, `getContent(rowTitle)` — content wrapper (grid or nested tabs) right after the row header; `select(rowTitle \| rowTitle[])` — click the row title, an array extends the selection via shift-clicks; `toggle(rowTitle)` — collapse an expanded row, expand a collapsed one                                                                                                                                                                                                                                                                                                                                                                                                |
| `Tabs`                        | `Tabs.ts`                                       | Tab bar of a tabs layout (top-level or nested in a row)                   | `getTitle(tabTitle, scope?)` — pass `rows.getContent(rowTitle)` as `scope` to look up a tab inside a specific row; `getContent(tabTitle)` — the layout container holding the tab's content; `select(tabTitle \| tabTitle[])` — click the tab title, an array extends the selection via shift-clicks                                                                                                                                                                                                                                                                                                                                                                                            |
| `Canvas`                      | `Canvas.ts`                                     | Edit canvas add-actions strip (per grid, revealed on hover)               | `getContainer()`, `getAddPanelButton(panelsContainer?)`, `addPanel(panelsContainer?)`, `getAddTabButton(panelsContainer?)`, `addTab(panelsContainer?)`, `pasteTab(panelsContainer?)`, `ungroupTabs(panelsContainer?)`, `getAddRowButton(panelsContainer?)`, `addRow(panelsContainer?)`, `pasteRow(panelsContainer?)`, `ungroupRows(panelsContainer?)`, `getGroupPanelsButton(panelsContainer?)`, `groupPanels('row' \| 'tab', panelsContainer?)` — pass `panelsContainer` (e.g. `tabs.getContent(...)`, `rows.getContent(...)`) to target the add-actions strip of a nested grid                                                                                                               |

> The show/hide visibility toggle is a **Toolbar** control (`sidebar.toolbar.getVisibilityToggle()`), even though its selector lives under `components.Sidebar.*`. `Toolbar.getButton(name)` resolves buttons by accessible name, scoped to the sidebar container.

### Fixtures

`fixtures.ts` extends the plugin-e2e `test` with one lazy, test-scoped fixture per top-level page object. Specs import `test`/`expect` from it and never wire anything:

```typescript
import { test, expect } from './fixtures';

test('example', async ({ gotoDashboardPage, controls, sidebar }) => {
  await gotoDashboardPage({ uid: 'some-uid' });
  await controls.enterEditMode();
  // ...
});
```

Page objects work identically whether the spec navigates with `gotoDashboardPage({ uid })`, the `dashboardPage` fixture, or `flows.dashboards.importTestDashboard()`: locator resolution depends only on `page`, never on how navigation happened.

### Base class & constructor

All page objects inherit from `PageObject`, which provides the shared constructor. It takes a single `PageObjectArgs` object:

```typescript
// page-objects/PageObject.ts
export interface PageObjectArgs {
  page: Page;
  getByGrafanaSelector: GetByGrafanaSelector; // resolves a Grafana E2E selector to a Locator
  selectors: E2ESelectorGroups;
  components: Components;
}

export abstract class PageObject {
  constructor({ page, getByGrafanaSelector, selectors, components }: PageObjectArgs) {
    // assigned to protected fields
  }
}
```

Page objects deliberately receive only the selector-resolving function, not a whole `DashboardPage`: they cannot navigate, mock, or wait — those responsibilities stay in specs and `helpers/`. Simple page objects (e.g. `Controls`, `Toolbar`) inherit the constructor directly — no override needed. Page objects that compose sub-objects (e.g. `Sidebar`) declare `constructor(args: PageObjectArgs)`, call `super(args)`, and pass the same `args` to their children. Construction is wired once in `fixtures.ts` (`buildGetByGrafanaSelector`) — specs never call `new`.

## Helpers Reference

Shared spec helpers live in `helpers/` and are imported from its barrel (`import { flows, movePanel, expectRowToBeVisible } from './helpers'`). Each file has one responsibility — put new helpers in the right one:

| File            | Responsibility                                                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flows.ts`      | Multi-step user flows (setup, navigation) composed from page objects, exposed as the namespaced `flows` object (`flows.dashboards.*`, `flows.variables.*`, `flows.navigation.*`) |
| `utils.ts`      | Pixel/timing-sensitive mechanics: drag-and-drop and `boundingBox()` geometry                                                                                                     |
| `assertions.ts` | Reusable assertion bundles (`expect` calls over page-object locators)                                                                                                            |

## How to Write a New Test

1. **Identify which page objects and helpers you need.** Check the two reference tables above. If the interaction you need isn't covered, add the method to the appropriate page object or helper file — only what the new test requires.

2. **Scaffold the spec** following this structure:

```typescript
import { test, expect } from './fixtures';

test.describe(
  'Feature name',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('describes the user-visible behavior', async ({ gotoDashboardPage, controls, sidebar }) => {
      await gotoDashboardPage({ uid: 'dashboard-uid' });

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
- **No waits or retries inside page objects** unless the pre-refactor code had them. Keep `toPass()` retries, drag-and-drop, scroll logic, and `boundingBox()` in the spec or in `helpers/utils.ts`.
- **Locators re-resolve on every action.** Playwright re-resolves a `Locator` when each action runs. Two methods that each embed the same positional filter (e.g. `hoverLastRow()` and `clickLastRowButton()` both using `.last()`) can hit two different nodes if the DOM shifts between calls. Prefer one getter that returns the locator (`getLastRow()`) and reuse that value for every related step. Never return pre-resolved snapshots from page objects; `boundingBox()` is point-in-time and stays inline.

### Selector scoping

- **Scope lookups to the owning container.** A bare `page.getByRole(...)` searches the whole page and can match an unrelated element with the same role and name — if not today, then after an unrelated UI change. Elements that belong to a region with a page object must be looked up through that region's container: e.g. radio buttons in the sidebar are `sidebar.getContainer().getByRole('radio', { name: '...' })`, the same way `Toolbar.getButton()` scopes button names to `Sidebar.container`. Inside a page object, chain from the container selector (`this.getByGrafanaSelector(this.selectors.components.Sidebar.container).getByRole(...)`).
- **Portalled UI is the only exception.** Select/Combobox option lists, modals, tooltips, and toasts render in a portal at the document root, outside their logical parent, so they cannot be scoped to it. Anchor them to the portal's own root instead: `page.getByRole('listbox').getByRole('option', { name })` (see `RepeatOptions`), or `page.getByRole('dialog', { name: 'Delete panel?' })`. A bare `page.getByRole('option', ...)` with no anchor is still too broad.

### Specs

- **One raw `getByGrafanaSelector` is allowed** for one-off assertions that aren't reusable interactions (e.g. a breadcrumb check).
- **Timing-sensitive mechanics stay inline** — `toPass()`, `mouse` sequences, `page.evaluate()`.
- **Test setup stays in the spec or in `helpers/flows.ts`** — API calls, dashboard provisioning (`flows.dashboards.importTestDashboard()`), navigation via `gotoDashboardPage()`. Never in page objects.
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
