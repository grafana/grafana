import { type Page } from '@playwright/test';

import { type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { PageObject } from './PageObject';

// Right side sidebar (open pane): Dashboard options, Panel options, Content outline, etc.
export class Sidebar extends PageObject {
  public dashboardOptions: DashboardOptions;

  constructor(page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
    super(page, dashboardPage, selectors);
    this.dashboardOptions = new DashboardOptions(page, dashboardPage, selectors);
  }
}

class DashboardOptions extends PageObject {
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
