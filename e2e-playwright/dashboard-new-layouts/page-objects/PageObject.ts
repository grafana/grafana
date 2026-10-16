import { type Page } from '@playwright/test';

import { type Components, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

/**
 * Resolves a Grafana E2E selector to a Locator. Same signature as
 * `GrafanaPage.getByGrafanaSelector` from plugin-e2e, so the type tracks
 * upstream changes. Page objects receive only this function (not a whole
 * `DashboardPage`) so they cannot navigate, mock, or wait — those belong to specs and fixtures.
 */
export type GetByGrafanaSelector = DashboardPage['getByGrafanaSelector'];

export interface PageObjectArgs {
  page: Page;
  getByGrafanaSelector: GetByGrafanaSelector;
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
  protected getByGrafanaSelector: GetByGrafanaSelector;
  protected selectors: E2ESelectorGroups;
  protected components: Components;

  constructor({ page, getByGrafanaSelector, selectors, components }: PageObjectArgs) {
    this.page = page;
    this.getByGrafanaSelector = getByGrafanaSelector;
    this.selectors = selectors;
    this.components = components;
  }
}
