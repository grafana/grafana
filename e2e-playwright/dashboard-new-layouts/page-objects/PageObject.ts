import { type Page } from '@playwright/test';

import { type Components, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

export interface PageObjectArgs {
  page: Page;
  dashboardPage: DashboardPage;
  selectors: E2ESelectorGroups;
  components: Components;
}

/**
 * Base class for all page objects. A page object represents one region of the
 * dashboard UI and wraps its raw selector chains behind user-intent methods,
 * so specs read as user actions and selector changes stay in one place.
 *
 * A page object is responsible for locating elements in its region (getters
 * returning a `Locator`) and wrapping interactions with them (action methods
 * using `test.step()`).
 *
 * It is NOT responsible for assertions (`expect` belongs in the spec), waits
 * and retries (`toPass()`, drag-and-drop, scroll logic stay in the spec or in
 * `utils.ts`), or test setup (API calls, dashboard provisioning, navigation).
 */
export abstract class PageObject {
  protected page: Page;
  protected dashboardPage: DashboardPage;
  protected selectors: E2ESelectorGroups;
  protected components: Components;

  constructor({ page, dashboardPage, selectors, components }: PageObjectArgs) {
    this.page = page;
    this.dashboardPage = dashboardPage;
    this.selectors = selectors;
    this.components = components;
  }
}
