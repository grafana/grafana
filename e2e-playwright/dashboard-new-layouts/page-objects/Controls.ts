import { test, type Page } from '@playwright/test';

import { type E2ESelectorGroups, type DashboardPage } from '@grafana/plugin-e2e';

// Controls above the dashboard: timepicker, refresh button, edit button, save button
export class Controls {
  private page: Page;
  private dashboardPage: DashboardPage;
  private selectors: E2ESelectorGroups;

  constructor(page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
    this.page = page;
    this.dashboardPage = dashboardPage;
    this.selectors = selectors;
  }

  async enterEditMode() {
    await test.step('Enter edit mode', async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.NavToolbar.editDashboard.editButton)
        .click();
    });
  }
}
