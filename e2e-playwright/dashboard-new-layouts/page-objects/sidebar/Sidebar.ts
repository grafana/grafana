import { test, type Page } from '@playwright/test';

import { type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { PageObject } from '../PageObject';

import { AddOptions } from './AddOptions';
import { ContentOutline } from './ContentOutline';
import { DashboardOptions } from './DashboardOptions';
import { PanelOptions } from './PanelOptions';
import { Toolbar } from './Toolbar';

// The whole right-side sidebar region: the icon Toolbar plus the open pane that holds
// dashboard/panel options. Mirrors the @grafana/ui <Sidebar> container that wraps both.
export class Sidebar extends PageObject {
  public toolbar: Toolbar;
  public addOptions: AddOptions;
  public dashboardOptions: DashboardOptions;
  public panelOptions: PanelOptions;
  public contentOutline: ContentOutline;

  constructor(page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
    super(page, dashboardPage, selectors);
    this.toolbar = new Toolbar(page, dashboardPage, selectors);
    this.addOptions = new AddOptions(page, dashboardPage, selectors);
    this.dashboardOptions = new DashboardOptions(page, dashboardPage, selectors);
    this.panelOptions = new PanelOptions(page, dashboardPage, selectors);
    this.contentOutline = new ContentOutline(page, dashboardPage, selectors);
  }

  getContainer() {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.container);
  }

  async clickGoBackButton() {
    await test.step('Click go back button in sidebar', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.goBack).click();
    });
  }

  getDockToggle() {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.dockToggle);
  }

  async clickCloseButton() {
    await test.step('Click close button in sidebar', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.closePane).click();
    });
  }

  async clickDeleteButton(options: { confirm: boolean } = { confirm: false }) {
    const stepTitle = options.confirm
      ? 'Delete selected element(s) (with confirmation)'
      : 'Click delete button in sidebar';

    await test.step(stepTitle, async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.EditPaneHeader.deleteButton).click();

      if (options.confirm) {
        await this.dashboardPage.getByGrafanaSelector(this.selectors.pages.ConfirmModal.delete).click();
      }
    });
  }
}
