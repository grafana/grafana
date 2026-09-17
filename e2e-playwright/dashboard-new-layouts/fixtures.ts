/* eslint-disable react-hooks/rules-of-hooks -- `use` is the Playwright fixture API, not a React hook */
import { type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

import { DashboardPage, type E2ESelectorGroups, test as base } from '@grafana/plugin-e2e';

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
export const test = base.extend<PageObjectFixtures>({
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

export { expect } from '@grafana/plugin-e2e';
