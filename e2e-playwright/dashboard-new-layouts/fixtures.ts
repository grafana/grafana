/* eslint-disable react-hooks/rules-of-hooks -- `use` is the Playwright fixture API, not a React hook */
import { type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

import { DashboardPage, type E2ESelectorGroups, type PluginOptions, test as base } from '@grafana/plugin-e2e';

import { Canvas, Controls, Panels, Rows, Sidebar, Tabs } from './page-objects';
import { type GetByGrafanaSelector } from './page-objects/PageObject';

interface PageObjectFixtures {
  controls: Controls;
  sidebar: Sidebar;
  panels: Panels;
  rows: Rows;
  tabs: Tabs;
  canvas: Canvas;
}

interface DragAndDropWorkerOptions {
  /**
   * Turns on the unified drag and drop flag in specs that set their flags with
   * `dragAndDropOpenFeature()`. Set by the `dashboard-new-layouts-unified-dnd` project.
   */
  unifiedDragAndDrop: boolean;
  /**
   * Also turns on the new grid view flag, so the new custom grid renders view mode too, in specs that
   * set their flags with `dragAndDropOpenFeature()`. Set by the `dashboard-new-layouts-new-grid-view`
   * project, together with `unifiedDragAndDrop`, since the view flag only takes effect with it.
   */
  newGridView: boolean;
}

const UNIFIED_DRAG_AND_DROP_FLAG = 'grafana.dashboardUnifiedDragAndDrop';
const NEW_GRID_VIEW_FLAG = 'grafana.dashboardNewGridView';

type OpenFeatureOption = PluginOptions['openFeature'];

interface BaseArgs {
  page: Page;
  request: APIRequestContext;
  selectors: E2ESelectorGroups;
  grafanaVersion: string;
}

function buildGetByGrafanaSelector(
  { page, request, selectors, grafanaVersion }: BaseArgs,
  testInfo: TestInfo
): GetByGrafanaSelector {
  // getByGrafanaSelector resolves locators from `page` alone and never depends
  // on navigation state, so this non-navigated DashboardPage behaves identically
  // to the instances created by gotoDashboardPage() or the dashboardPage fixture.
  // Not depending on the built-in dashboardPage fixture is deliberate: its setup
  // navigates to a new empty dashboard, which specs using gotoDashboardPage never
  // want.
  const dashboardPage = new DashboardPage({ page, selectors, grafanaVersion, request, testInfo });
  return dashboardPage.getByGrafanaSelector.bind(dashboardPage);
}

/**
 * Extends the plugin-e2e `test` with one fixture per page object, so specs
 * destructure them from the test arguments instead of constructing them:
 *
 * ```typescript
 * import { test, expect } from './fixtures';
 *
 * test('...', async ({ gotoDashboardPage, controls, sidebar }) => {
 *   await gotoDashboardPage({ uid: '...' });
 *   await controls.enterEditMode();
 * });
 * ```
 */
export const test = base.extend<PageObjectFixtures, DragAndDropWorkerOptions & { unifiedDragAndDropGuard: void }>({
  unifiedDragAndDrop: [false, { scope: 'worker', option: true }],
  newGridView: [false, { scope: 'worker', option: true }],
  // A spec that sets `openFeature` directly would silently run with the flags off in the unified
  // drag and drop and new grid view projects, so fail its tests there instead
  unifiedDragAndDropGuard: [
    async ({ unifiedDragAndDrop, newGridView, openFeature }, use) => {
      const missing = [
        unifiedDragAndDrop && openFeature.flags[UNIFIED_DRAG_AND_DROP_FLAG] !== true && UNIFIED_DRAG_AND_DROP_FLAG,
        newGridView && openFeature.flags[NEW_GRID_VIEW_FLAG] !== true && NEW_GRID_VIEW_FLAG,
      ].filter(Boolean);
      if (missing.length > 0) {
        throw new Error(
          `${missing.join(', ')} off: set the spec's flags with test.use({ openFeature: dragAndDropOpenFeature(...) })`
        );
      }
      await use();
    },
    { scope: 'worker', auto: true },
  ],
  controls: async ({ page, request, selectors, components, grafanaVersion }, use, testInfo) => {
    const getByGrafanaSelector = buildGetByGrafanaSelector({ page, request, selectors, grafanaVersion }, testInfo);
    await use(new Controls({ page, selectors, components, getByGrafanaSelector }));
  },
  sidebar: async ({ page, request, selectors, components, grafanaVersion }, use, testInfo) => {
    const getByGrafanaSelector = buildGetByGrafanaSelector({ page, request, selectors, grafanaVersion }, testInfo);
    await use(new Sidebar({ page, selectors, components, getByGrafanaSelector }));
  },
  panels: async ({ page, request, selectors, components, grafanaVersion }, use, testInfo) => {
    const getByGrafanaSelector = buildGetByGrafanaSelector({ page, request, selectors, grafanaVersion }, testInfo);
    await use(new Panels({ page, selectors, components, getByGrafanaSelector }));
  },
  rows: async ({ page, request, selectors, components, grafanaVersion }, use, testInfo) => {
    const getByGrafanaSelector = buildGetByGrafanaSelector({ page, request, selectors, grafanaVersion }, testInfo);
    await use(new Rows({ page, selectors, components, getByGrafanaSelector }));
  },
  tabs: async ({ page, request, selectors, components, grafanaVersion }, use, testInfo) => {
    const getByGrafanaSelector = buildGetByGrafanaSelector({ page, request, selectors, grafanaVersion }, testInfo);
    await use(new Tabs({ page, selectors, components, getByGrafanaSelector }));
  },
  canvas: async ({ page, request, selectors, components, grafanaVersion }, use, testInfo) => {
    const getByGrafanaSelector = buildGetByGrafanaSelector({ page, request, selectors, grafanaVersion }, testInfo);
    await use(new Canvas({ page, selectors, components, getByGrafanaSelector }));
  },
});

/**
 * `openFeature` option for drag and drop and grid rendering specs: `flags` plus the unified drag and
 * drop flag, which is on in the `dashboard-new-layouts-unified-dnd` and
 * `dashboard-new-layouts-new-grid-view` projects, and the new grid view flag, which is on in the
 * latter only. Both are off everywhere else, so one spec covers every grid path. Tag the drag and drop
 * tests with `@drag-and-drop`, and tests of how the grid renders (view mode in particular) with
 * `@new-grid-view`, so those projects pick them up. `openFeature` is worker-scoped, so pass this to a
 * top-level `test.use()`:
 *
 * ```typescript
 * test.use({ openFeature: dragAndDropOpenFeature({ dashboardUndoRedo: true }) });
 * ```
 */
export function dragAndDropOpenFeature(
  flags: OpenFeatureOption['flags'] = {}
): [
  (options: DragAndDropWorkerOptions, use: (openFeature: OpenFeatureOption) => Promise<void>) => Promise<void>,
  { scope: 'worker' },
] {
  return [
    async ({ unifiedDragAndDrop, newGridView }, use) => {
      await use({
        flags: { ...flags, [UNIFIED_DRAG_AND_DROP_FLAG]: unifiedDragAndDrop, [NEW_GRID_VIEW_FLAG]: newGridView },
      });
    },
    { scope: 'worker' },
  ];
}

export { expect } from '@grafana/plugin-e2e';
