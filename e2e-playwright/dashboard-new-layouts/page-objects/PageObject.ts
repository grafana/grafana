import { type Page } from '@playwright/test';

import { type Components, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

export interface PageObjectArgs {
  page: Page;
  dashboardPage: DashboardPage;
  selectors: E2ESelectorGroups;
  components: Components;
}

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
