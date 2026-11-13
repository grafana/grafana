import { test, type Locator } from '@playwright/test';

import { PageObject, type PageObjectArgs } from './PageObject';
import { PanelOptions } from './sidebar/PanelOptions';

/** The visualization editor, including its preview, visualization picker, and panel options. */
export class PanelEditor extends PageObject {
  readonly options: PanelOptions;

  constructor(args: PageObjectArgs) {
    super(args);
    this.options = new PanelOptions(args, this.getContainer());
  }

  /** Returns the visualization editor container. */
  getContainer(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.PanelEditor.General.content);
  }

  /** Returns the subtitle rendered in the editor's panel preview. */
  getPreviewSubtitle(): Locator {
    return this.getContainer().getByTestId(this.selectors.components.Panels.Panel.subtitle);
  }

  /** Returns the editor's table-view switch. */
  getTableViewSwitch(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.PanelEditor.toggleTableView);
  }

  /** Returns the button that opens the visualization picker when it is closed. */
  getVisualizationPickerToggle(): Locator {
    return this.getContainer().getByTestId(this.selectors.components.PanelEditor.toggleVizPicker);
  }

  /** Returns the All visualizations tab in the open picker. */
  getAllVisualizationsTab(): Locator {
    return this.getContainer().getByRole('tab', { name: 'All visualizations', exact: true });
  }

  /** Opens the visualization picker; the picker must be closed. */
  async openVisualizationPicker() {
    await test.step('Open the visualization picker', async () => {
      await this.getVisualizationPickerToggle().click();
    });
  }

  /** Selects a visualization by its displayed name; the picker must already be open. */
  async selectVisualization(name: string) {
    await test.step(`Select visualization "${name}"`, async () => {
      await this.getAllVisualizationsTab().click();
      await this.getContainer().getByTestId(this.selectors.components.PluginVisualization.item(name)).click();
    });
  }

  /** Switches the query editor sidebar between Mini and Full. */
  async toggleSidebarSize() {
    await test.step('Switch the query editor between Mini and Full', async () => {
      await this.getContainer().getByRole('button', { name: 'Toggle sidebar size', exact: true }).click();
    });
  }

  /** Switches the panel preview between the visualization and table view. */
  async toggleTableView() {
    await test.step('Toggle table view', async () => {
      await this.getTableViewSwitch().click({ force: true });
    });
  }
}
