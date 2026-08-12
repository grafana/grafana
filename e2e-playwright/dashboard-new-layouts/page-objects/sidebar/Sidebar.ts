import { type Locator, test } from '@playwright/test';

import { PageObject, type PageObjectArgs } from '../PageObject';

import { AddOptions } from './AddOptions';
import { ContentOutline } from './ContentOutline';
import { DashboardOptions } from './DashboardOptions';
import { GroupOptions } from './GroupOptions';
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
  readonly toolbar: Toolbar;
  readonly contentOutline: ContentOutline;
  readonly addOptions: AddOptions;
  readonly dashboardOptions: DashboardOptions;
  readonly variableOptions: VariableOptions;
  readonly panelOptions: PanelOptions;
  readonly rowOptions: RowOptions;
  readonly tabOptions: TabOptions;
  readonly groupOptions: GroupOptions;

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
    this.groupOptions = new GroupOptions(args);
  }

  /** Returns the sidebar container */
  getContainer(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.Sidebar.container);
  }

  /** Goes back to the previous pane by clicking the sidebar's back button */
  async goBack() {
    await test.step('Go back to previous pane', async () => {
      await this.getByGrafanaSelector(this.selectors.components.Sidebar.goBack).click();
    });
  }

  /** Returns the dock/undock toggle */
  getDockToggle(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.Sidebar.dockToggle);
  }

  /** Closes the open pane */
  async closePane() {
    await test.step('Close pane', async () => {
      await this.getByGrafanaSelector(this.selectors.components.Sidebar.closePane).click();
    });
  }

  /** Duplicates the selected element via the edit pane header */
  async duplicateSelection() {
    await test.step('Duplicate selected element', async () => {
      await this.getByGrafanaSelector(this.selectors.components.EditPaneHeader.duplicate).click();
    });
  }

  /** Copies the selected element via the edit pane header */
  async copySelection() {
    await test.step('Copy selected element', async () => {
      await this.getByGrafanaSelector(this.selectors.components.EditPaneHeader.copy).click();
    });
  }

  /**
   * Deletes the selected element(s) via the edit pane header
   * @param confirm when true, also confirms the deletion in the confirmation modal
   */
  async deleteSelection({ confirm = false }: { confirm?: boolean } = {}) {
    const stepTitle = confirm ? 'Delete selected element(s) (with confirmation)' : 'Delete selected element(s)';

    await test.step(stepTitle, async () => {
      await this.getByGrafanaSelector(this.selectors.components.EditPaneHeader.deleteButton).click();

      if (confirm) {
        await this.getByGrafanaSelector(this.selectors.pages.ConfirmModal.delete).click();
      }
    });
  }
}
