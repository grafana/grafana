import { type Page } from '@playwright/test';

import { type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

// Right side sidebar (open pane): Dashboard options, Panel options, Content outline, etc.
export class Sidebar {
  private page: Page;
  private dashboardPage: DashboardPage;
  private selectors: E2ESelectorGroups;
  public dashboardOptions: DashboardOptions;

  constructor(page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
    this.page = page;
    this.dashboardPage = dashboardPage;
    this.selectors = selectors;

    this.dashboardOptions = new DashboardOptions(page, dashboardPage, selectors);
  }
}

class DashboardOptions {
  private page: Page;
  private dashboardPage: DashboardPage;
  private selectors: E2ESelectorGroups;

  constructor(page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
    this.page = page;
    this.dashboardPage = dashboardPage;
    this.selectors = selectors;
  }

  getTitleInput() {
    return this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.PanelEditor.OptionsPane.fieldLabel('dashboard-options Title'))
      .locator('input');
  }

  getDescriptionTextarea() {
    return this.dashboardPage
      .getByGrafanaSelector(
        this.selectors.components.PanelEditor.OptionsPane.fieldLabel('dashboard-options Description')
      )
      .locator('textarea');
  }
}
