import { type Page } from '@playwright/test';

import { type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

export abstract class PageObject {
  constructor(
    protected page: Page,
    protected dashboardPage: DashboardPage,
    protected selectors: E2ESelectorGroups
  ) {}
}
