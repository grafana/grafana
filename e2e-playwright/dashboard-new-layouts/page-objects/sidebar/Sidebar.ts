import { test, type Page } from '@playwright/test';

import { type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { PageObject } from '../PageObject';

import { DashboardOptions } from './DashboardOptions';
import { PanelOptions } from './PanelOptions';
import { Toolbar } from './Toolbar';

// The whole right-side sidebar region: the icon Toolbar plus the open pane that holds
// dashboard/panel options. Mirrors the @grafana/ui <Sidebar> container that wraps both.
export class Sidebar extends PageObject {
  public toolbar: Toolbar;
  public dashboardOptions: DashboardOptions;
  public panelOptions: PanelOptions;

  constructor(page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
    super(page, dashboardPage, selectors);
    this.toolbar = new Toolbar(page, dashboardPage, selectors);
    this.dashboardOptions = new DashboardOptions(page, dashboardPage, selectors);
    this.panelOptions = new PanelOptions(page, dashboardPage, selectors);
  }

  getContainer() {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.container);
  }

  getGoBackButton() {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.goBack);
  }

  getDockToggle() {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.dockToggle);
  }

  getCloseButton() {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.closePane);
  }

  async clickDeleteButton() {
    await test.step('Click delete button in sidebar', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.EditPaneHeader.deleteButton).click();
    });
  }
}
