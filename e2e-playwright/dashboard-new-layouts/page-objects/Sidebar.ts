import { test, type Page } from '@playwright/test';

import { type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { PageObject } from './PageObject';

// Right side sidebar (open pane): Dashboard options, Panel options, Content outline, etc.
export class Sidebar extends PageObject {
  public dashboardOptions: DashboardOptions;
  public panelOptions: PanelOptions;

  constructor(page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
    super(page, dashboardPage, selectors);
    this.dashboardOptions = new DashboardOptions(page, dashboardPage, selectors);
    this.panelOptions = new PanelOptions(page, dashboardPage, selectors);
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

class PanelOptions extends PageObject {
  getTitleInput() {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.OptionsPane.fieldInput('Title')
    );
  }

  getDescriptionTextarea() {
    return this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.PanelEditor.OptionsPane.fieldLabel('panel-options Description'))
      .locator('textarea');
  }

  async toggleTransparentBackground() {
    await test.step('Toggle transparent background', async () => {
      await this.page.getByRole('switch', { name: 'Transparent background' }).click({ force: true });
    });
  }
}
