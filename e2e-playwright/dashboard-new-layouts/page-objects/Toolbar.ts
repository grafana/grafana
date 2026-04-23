import { test, type Page } from '@playwright/test';

import { type E2ESelectorGroups, type DashboardPage } from '@grafana/plugin-e2e';

// Right side toolbar with icon buttons: Add new element (+), Dashboard options (cog), Content outline, etc.
export class Toolbar {
  private page: Page;
  private dashboardPage: DashboardPage;
  private selectors: E2ESelectorGroups;

  constructor(page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
    this.page = page;
    this.dashboardPage = dashboardPage;
    this.selectors = selectors;
  }

  async openDashboardOptions() {
    await test.step('Open dashboard options', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.pages.Dashboard.Sidebar.optionsButton).click();
    });
  }
}
