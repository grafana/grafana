import { test, type Locator } from '@playwright/test';

import { PageObject, type PageObjectArgs } from './PageObject';
import { PanelOptions } from './sidebar/PanelOptions';

export class PanelEditor extends PageObject {
  readonly options: PanelOptions;

  constructor(args: PageObjectArgs) {
    super(args);
    this.options = new PanelOptions(args, this.getContainer());
  }

  getContainer(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.PanelEditor.General.content);
  }

  getPreviewSubtitle(): Locator {
    return this.getContainer().getByTestId(this.selectors.components.Panels.Panel.subtitle);
  }

  getTableViewSwitch(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.PanelEditor.toggleTableView);
  }

  getVisualizationPickerToggle(): Locator {
    return this.getContainer().getByTestId(this.selectors.components.PanelEditor.toggleVizPicker);
  }

  getAllVisualizationsTab(): Locator {
    return this.getContainer().getByRole('tab', { name: 'All visualizations', exact: true });
  }

  async selectVisualization(name: string) {
    await test.step(`Select visualization "${name}"`, async () => {
      const toggle = this.getVisualizationPickerToggle();
      if (await toggle.isVisible()) {
        await toggle.click();
      }
      await this.getAllVisualizationsTab().click();
      await this.getContainer().getByTestId(this.selectors.components.PluginVisualization.item(name)).click();
    });
  }

  async toggleSidebarSize() {
    await test.step('Switch the query editor between Mini and Full', async () => {
      await this.getContainer().getByRole('button', { name: 'Toggle sidebar size', exact: true }).click();
    });
  }

  async toggleTableView() {
    await test.step('Toggle table view', async () => {
      await this.getTableViewSwitch().click({ force: true });
    });
  }
}
