import { test } from '@playwright/test';

import { PageObject, type PageObjectArgs } from '../PageObject';

import { AddOptions } from './AddOptions';
import { ContentOutline } from './ContentOutline';
import { DashboardOptions } from './DashboardOptions';
import { PanelOptions } from './PanelOptions';
import { RowOptions } from './RowOptions';
import { TabOptions } from './TabOptions';
import { Toolbar } from './Toolbar';
import { VariableOptions } from './VariableOptions';

/**
 * The whole right-side sidebar region: the icon Toolbar plus the open pane that holds
 * dashboard/panel options. Mirrors the @grafana/ui <Sidebar> container that wraps both.
 */
export class Sidebar extends PageObject {
  public toolbar: Toolbar;
  public contentOutline: ContentOutline;
  public addOptions: AddOptions;
  public dashboardOptions: DashboardOptions;
  public variableOptions: VariableOptions;
  public panelOptions: PanelOptions;
  public rowOptions: RowOptions;
  public tabOptions: TabOptions;

  constructor(args: PageObjectArgs) {
    super(args);
    this.toolbar = new Toolbar(args);
    this.contentOutline = new ContentOutline(args);
    this.addOptions = new AddOptions(args);
    this.dashboardOptions = new DashboardOptions(args);
    this.variableOptions = new VariableOptions(args);
    this.panelOptions = new PanelOptions(args);
    this.rowOptions = new RowOptions(args);
    this.tabOptions = new TabOptions(args);
  }

  /** Returns the sidebar container */
  getContainer() {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.container);
  }

  /** Goes back to the previous pane by clicking the sidebar's back button */
  async clickGoBackButton() {
    await test.step('Click go back button in sidebar', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.goBack).click();
    });
  }

  /** Returns the dock/undock toggle */
  getDockToggle() {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.dockToggle);
  }

  /** Closes the open pane */
  async clickCloseButton() {
    await test.step('Click close button in sidebar', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.closePane).click();
    });
  }

  /** Duplicates the selected element via the edit pane header */
  async clickDuplicateButton() {
    await test.step('Duplicate selected element', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.EditPaneHeader.duplicate).click();
    });
  }

  /** Copies the selected element via the edit pane header */
  async clickCopyButton() {
    await test.step('Copy selected element', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.EditPaneHeader.copy).click();
    });
  }

  /**
   * Deletes the selected element(s) via the edit pane header
   * @param confirm when true, also confirms the deletion in the confirmation modal
   */
  async clickDeleteButton({ confirm = false }: { confirm?: boolean } = {}) {
    const stepTitle = confirm ? 'Delete selected element(s) (with confirmation)' : 'Click delete button in sidebar';

    await test.step(stepTitle, async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.EditPaneHeader.deleteButton).click();

      if (confirm) {
        await this.dashboardPage.getByGrafanaSelector(this.selectors.pages.ConfirmModal.delete).click();
      }
    });
  }
}
