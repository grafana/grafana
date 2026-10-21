# dashboard-new-layouts E2E Tests — Agent Guide

## Purpose

This suite contains Playwright E2E tests for the V2 dashboard layout system. Tests use **page objects** to wrap raw selector chains behind user-intent methods, so specs read like user stories (`controls.enterEditMode()`) instead of selector chains, each interaction has exactly one implementation, and selector changes touch one file instead of every spec.

For general spec-authoring principles (assert real behavior, avoiding AI-slop tests, anti-flake rules) that apply to any Grafana frontend test, also invoke the `frontend-testing-strategy` skill with the Skill tool — this guide covers what's specific to this suite's page-object pattern on top of that.

## Start Here

1. Read an existing spec for the feature and the relevant page objects and helpers. Reuse existing methods before proposing new ones.
2. Import `test` and `expect` from this suite's `fixtures.ts`; receive page objects through test arguments. Specs never construct them.
3. Keep interactions in page objects, setup/navigation in specs or flows, and behavior assertions in specs or assertion helpers.
4. Scope locators to their owning UI region. One raw `getByGrafanaSelector` lookup per region per spec is allowed for a one-off assertion; see "Specs" below.
5. **Get explicit user confirmation before adding a page-object method or a new selector.** The proposal requirements are in "Page objects" and "Selector scoping" below.
6. For persistence checks, use `flows.dashboards.saveDashboard(page, controls)`, which confirms the save and reloads by default.
7. Run the affected spec three times:

```bash
pnpm e2e:pw --project dashboard-new-layouts --reporter list --repeat-each=3 -- <spec-filename>
```

## Conventions

### Page objects

- **JSDoc**: Follow the existing page objects' documentation style. Add a `/** ... */` comment to every new page-object class describing the UI region it owns, and to every public getter or action describing what it returns or does. Use `@param` when an argument needs clarification (e.g. a displayed label versus an underlying key, an optional scope, or a confirmation flag). Document non-obvious limits such as virtualized rows or first-match behavior. Check the other page objects before adding or extending one.
- **Locator getters** (e.g. `getTitleInput()`) return a Playwright `Locator` — for elements that specs assert on (or both act on and assert on). The test owns the assertion — never the page object.
- **Action methods** (e.g. `enterEditMode()`, `closePane()`) wrap interactions — multi-step flows or single clicks on act-only elements — and use `test.step()` so the HTML report shows named steps.
- **When a spec needs both**, pair them: the action method delegates to the getter (see `Toolbar.getButton()` / `clickButton()`).
- **No speculative methods.** Only add methods needed by the current (or new) spec.
- **Decide whether extraction helps.** A new method should serve a concrete need: the same lookup or action is used by multiple tests, or it hides a complicated lookup or interaction in the UI region the page object owns. Name the actual consumers and distinguish current reuse from possible future reuse; hypothetical reuse alone is not a reason to add a method. For one-off assertions, prefer existing getters with scoped locators and keep the assertion inline, within the exceptions in "Specs" below. Do not add a getter merely to wrap every simple lookup. UI interactions still belong to their owning page objects.
- **Ask before adding methods.** Before adding any new page-object method, show the user its proposed class, name, purpose, the tests that need it, and why existing methods or an allowed inline lookup are insufficient. Explain whether the benefit is reuse or hiding complexity, then wait for explicit user confirmation before adding it.
- **Plural vs singular getters** (e.g. `getPanels()` / `getPanel()`): plural getters return every match — assert counts or narrow (`.first()`, `.nth()`) in the spec; singular getters return the first match.
- **Scoped lookups**: getters with a `scope?: Locator` parameter search inside that container — pass `rows.getContent(...)` or `tabs.getContent(...)` to look up elements in a specific row or tab.
- **No waits or retries inside page objects** unless the pre-refactor code had them. Keep `toPass()` retries, drag-and-drop, scroll logic, and `boundingBox()` in the spec or in `helpers/utils.ts`.
- **Locators re-resolve on every action.** Playwright re-resolves a `Locator` when each action runs. Two methods that each embed the same positional filter (e.g. `hoverLastRow()` and `clickLastRowButton()` both using `.last()`) can hit two different nodes if the DOM shifts between calls. Reusing the same positional locator does not preserve element identity. When related steps must target the same row, locate it by a stable ID or unique title rather than `.last()` or `.nth()`. Never return pre-resolved snapshots from page objects; `boundingBox()` is point-in-time and stays inline.

### Selector scoping

- **Scope lookups to the owning container.** A bare `page.getByRole(...)` searches the whole page and can match an unrelated element with the same role and name — if not today, then after an unrelated UI change. Elements that belong to a region with a page object must be looked up through that region's container: e.g. radio buttons in the sidebar are `sidebar.getContainer().getByRole('radio', { name: '...' })`, the same way `Toolbar.getButton()` scopes button names to `Sidebar.container`. Inside a page object, chain from the container selector (`this.getByGrafanaSelector(this.selectors.components.Sidebar.container).getByRole(...)`).
- **Portalled UI is the only exception.** Select/Combobox option lists, modals, tooltips, and toasts render in a portal at the document root, outside their logical parent, so they cannot be scoped to it. Anchor them to the portal's own root instead: `page.getByRole('listbox').getByRole('option', { name })` (see `RepeatOptions`), or `page.getByRole('dialog', { name: 'Delete panel?' })`. A bare `page.getByRole('option', ...)` with no anchor is still too broad.
- **Add a selector when no meaningful container exists.** If the only way to reach an element is a page- or dialog-wide placeholder, CSS class, or position, a dedicated selector keeps the test robust and the component's testable surface explicit. **Agents: pause before adding one.** Suggest to the user which selectors to create (name, component, element it goes on, and the locators it would replace), then wait for their approval before changing selectors, components, or continuing to write the tests that depend on them. Put it on a stable container or repeated item (e.g. `StaticOptionsEditor.spreadsheet` and `spreadsheetRow` on the static options table and its rows), not on every cell, and scope the inner lookups from it. Version the new selector with the current Grafana release in `@grafana/e2e-selectors` and add its `data-testid` to the component. Do not reuse a selector that belongs to a different component (e.g. the legacy editor's `StaticOptionsEditor.row`). `@grafana/e2e-selectors` is published, so mention new selectors in the PR description.

### Specs

- **One raw `getByGrafanaSelector` lookup per UI region per spec is allowed** for one-off assertions that aren't reusable interactions (e.g. a breadcrumb check). When a second spec needs the same raw lookup, propose promoting it into a page-object getter or action and get user confirmation before adding the method.
- **Timing-sensitive mechanics stay inline**: `toPass()`, `mouse` sequences, `page.evaluate()`.
- **Test setup stays in the spec, a feature-local `flows.ts`, or `helpers/flows.ts`**: API calls, dashboard provisioning (`flows.dashboards.importTestDashboard()`), navigation via `gotoDashboardPage()`. Never in page objects.
- **Viewport**: use `test.use({ viewport: { width: 1920, height: 1080 } })` when tests involve layout-sensitive operations (drag-and-drop, panel positioning).
- **Persistence**: prefer `flows.dashboards.saveDashboard(page, controls)` over `controls.saveDashboard` plus a manual toast close / `page.reload()`.
- **Use page objects for interactions in each UI region.** The single raw-lookup allowance above is for a one-off assertion; it does not permit duplicating page-object interactions with raw selectors.
- **Exact text**: prefer `toHaveText` over `toContainText`, so extra or unexpected text fails the assertion. Use `toContainText` only when the full text is known to differ from what you assert (e.g. a dropdown option that renders its description after its label), and say why in a comment. With an array, `toHaveText` also checks the number of elements; `toContainText` does not, so pair it with `toHaveCount`.

### Adding a method to a page object

1. Find the raw selector chain in the spec you're writing or updating. Check whether an existing method or an allowed inline lookup is sufficient, and assess concrete reuse or complexity as described above.
2. Present the proposed method and its justification to the user, then wait for explicit confirmation before adding it.
3. Once confirmed, move the working selector chain or interaction into the appropriate page object, preserving which elements it matches, action order, and timing. This is a behavior-preserving extraction: use `this.page` and the shared dependencies, but do not add `.first()`, change matching rules, reorder actions, or introduce waits as part of the move. If the existing code violates these conventions, correct it explicitly and verify the change rather than silently changing it during extraction. New page objects must extend `PageObject` from `PageObject.ts`.
4. For interactions (multi-step flows or single clicks on act-only elements), wrap in `test.step('Human-readable name', async () => { ... })`.
5. For elements the spec asserts on, return a `Locator` (getter pattern, no `test.step` needed).
6. Run `--repeat-each=3` on the spec.

## Code Map

Read the relevant implementation before adding a method; its signatures and JSDoc are the API reference. All page objects live in `page-objects/`.

| UI region / responsibility                           | Start here                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Top navigation, time range, variable controls        | [`Controls.ts`](page-objects/Controls.ts)                                                                |
| Sidebar and its panes                                | [`sidebar/Sidebar.ts`](page-objects/sidebar/Sidebar.ts), then the corresponding pane class in `sidebar/` |
| Sidebar visibility toggle and toolbar buttons        | [`sidebar/Toolbar.ts`](page-objects/sidebar/Toolbar.ts), accessed through `sidebar.toolbar`              |
| Shared visibility rules, grid layout, repeat options | [`sidebar/shared/`](page-objects/sidebar/shared/), accessed through the owning pane                      |
| Panel containers, headers, bodies, selection         | [`Panels.ts`](page-objects/Panels.ts)                                                                    |
| Rows and their content                               | [`Rows.ts`](page-objects/Rows.ts)                                                                        |
| Tabs and their content                               | [`Tabs.ts`](page-objects/Tabs.ts)                                                                        |
| Canvas add, paste, and grouping controls             | [`Canvas.ts`](page-objects/Canvas.ts)                                                                    |
| Shared dependencies and constructor                  | [`PageObject.ts`](page-objects/PageObject.ts)                                                            |

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

For flows that need another browser page, destructure the `createNewDashboardPage` fixture and call `await createNewDashboardPage(url?)`. Each call creates a page in the current browser context and returns `{ page, rows, controls }`, with the page objects bound to that page. The optional URL is opened before the function returns; omitting it leaves the page blank. Creation and navigation appear under the `Create a new dashboard page` test step, and all pages created through the fixture are closed during test teardown. Pages and page objects are created only when the function is called.

```typescript
test('opens a shared row link', async ({ createNewDashboardPage }) => {
  const { rows } = await createNewDashboardPage('/d/dashboard-uid?drow=Details');
  await expect(rows.getToggle('Details')).toHaveAttribute('aria-expanded', 'true');
});
```

### Base class & constructor

Every page object extends `PageObject`. Its constructor takes a `PageObjectArgs` object with `page`, `getByGrafanaSelector`, `selectors`, and `components`, available as protected fields. Simple page objects inherit the constructor. Classes that compose sub-objects call `super(args)` and pass the same `args` to their children; see `sidebar/Sidebar.ts`.

Construction is wired in `fixtures.ts` through `buildGetByGrafanaSelector`. Specs never construct page objects; import their classes only as types when a helper signature needs them. Setup, navigation, mocking, and explicit waits belong in specs or helpers.

## Helpers Reference

Shared spec helpers live in `helpers/` and are imported from its barrel (`import { flows, movePanel, expectRowVisibility } from './helpers'`). Each file has one responsibility: put new helpers in the right one:

| File                                             | Responsibility                                                                                           | Extract when…                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [`helpers/flows.ts`](helpers/flows.ts)           | Setup and navigation sequences composed from page objects, exposed through the namespaced `flows` object | Three tests repeat the same sequence. Single interactions belong on page objects.   |
| [`helpers/utils.ts`](helpers/utils.ts)           | Shared drag-and-drop and `boundingBox()` geometry                                                        | Several specs need the same mouse/geometry sequence. Keep one-off mechanics inline. |
| [`helpers/assertions.ts`](helpers/assertions.ts) | Reusable bundles of assertions over page-object locators                                                 | A second spec needs the same bundle. Single assertions stay in the spec.            |

Use `flows.dashboards.saveDashboard(page, controls)` for save, toast confirmation, and reload. Reload is the default; pass `{ reloadPageAfterSave: false }` to keep the current page. Pass `{ title }` for a new dashboard or intentional Save as.

`flows.contentOutline.selectVariable()` toggles the Variables node rather than ensuring it is expanded; call it once per page load.

> `expectTabVisibility(tabTitle, tabs, visibility)` and `expectRowVisibility(rowTitle, rows, visibility)` assert that the element's title **and** content are both `'visible'` or both `'hidden'`. The `visibility` argument is required and has no default. Both helpers return `{ title, content }` locators: reuse those instead of calling `getTitle()` / `getContent()` again. A mixed state (a collapsed row keeps its title but unmounts its content) is not expressible with the single `visibility` argument: get the locators directly from the page object and assert that state inline without calling the helper. For a `'visible'` assertion, `expectTabVisibility` requires a tab that is **active** and hosts a **grid**: `Tabs.getContent()` resolves the `LayoutContainer('tab ...')` testid, which is not rendered for an inactive tab nor for a tab wrapping a nested rows layout. Assert the title alone in those cases.

Helpers reused only within a feature folder live in that folder's `helpers/` (`helpers/flows.ts`, `helpers/assertions.ts`), alongside its specs and fixtures. Reuse the suite-wide helpers from `../helpers`; promote a local helper into the suite-wide `helpers/` when another feature needs it. Extract a local flow when three tests (in one spec or across the folder's specs) repeat the same setup sequence. Check the folder's `helpers/` before writing such a sequence a third time.

For variable-specific setup and assertions, inspect [`variables/helpers/flows.ts`](variables/helpers/flows.ts) and [`variables/helpers/assertions.ts`](variables/helpers/assertions.ts). They cover isolated dashboard imports, variable creation, save-and-return flows, and preview/dropdown assertions. Import them directly from those files within `variables/`.

Do not put UI interactions that belong on a page object into helpers. Do not put the behavior-under-test assertion into `flows.ts` (flows may only assert to keep their own sequence reliable, e.g. waiting for a save toast).

## How to Write a New Test

Use this scaffold; specs in feature subdirectories must adjust the relative imports:

```typescript
import { test, expect } from './fixtures';
import { flows } from './helpers';

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
    test('describes the user-visible behavior', async ({ gotoDashboardPage, page, controls, sidebar }) => {
      await gotoDashboardPage({ uid: 'dashboard-uid' });

      await controls.enterEditMode();
      // ... action + assert (the toolbar is reached via sidebar.toolbar)

      await flows.dashboards.saveDashboard(page, controls);
      // ... re-assert persistence (reload is the default; pass { reloadPageAfterSave: false } to keep the current page)
    });
  }
);
```

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
