import { test } from '@playwright/test';

import { PageObject, type PageObjectArgs } from '../PageObject';

import { AddOptions } from './AddOptions';
import { ContentOutline } from './ContentOutline';
import { DashboardOptions } from './DashboardOptions';
import { PanelOptions } from './PanelOptions';
import { Toolbar } from './Toolbar';
import { VariableOptions } from './VariableOptions';

// The whole right-side sidebar region: the icon Toolbar plus the open pane that holds
// dashboard/panel options. Mirrors the @grafana/ui <Sidebar> container that wraps both.
export class Sidebar extends PageObject {
  public toolbar: Toolbar;
  public contentOutline: ContentOutline;
  public addOptions: AddOptions;
  public dashboardOptions: DashboardOptions;
  public variableOptions: VariableOptions;
  public panelOptions: PanelOptions;

  constructor(args: PageObjectArgs) {
    super(args);
    this.toolbar = new Toolbar(args);
    this.contentOutline = new ContentOutline(args);
    this.addOptions = new AddOptions(args);
    this.dashboardOptions = new DashboardOptions(args);
    this.variableOptions = new VariableOptions(args);
    this.panelOptions = new PanelOptions(args);
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
