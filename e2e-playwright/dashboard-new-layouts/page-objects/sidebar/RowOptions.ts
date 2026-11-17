import { type Locator, test } from '@playwright/test';

import { PageObject, type PageObjectArgs } from '../PageObject';

import { ConditionalRenderingOptions } from './shared/ConditionalRenderingOptions';
import { RepeatOptions } from './shared/RepeatOptions';

/**
 * The "Row options" pane in the sidebar: the row title input plus the
 * shared repeat options group
 */
export class RowOptions extends PageObject {
  readonly conditionalRenderingOptions: ConditionalRenderingOptions;
  readonly repeatOptions: RepeatOptions;

  constructor(args: PageObjectArgs) {
    super(args);
    this.conditionalRenderingOptions = new ConditionalRenderingOptions(args);
    this.repeatOptions = new RepeatOptions(args, 'dash-row-repeat');
  }

  /** Returns the row title input */
  getTitleInput(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.PanelEditor.ElementEditPane.RowsLayout.titleInput);
  }

  /** Returns the row's fill screen switch */
  getFillScreenSwitch(): Locator {
    return this.getByGrafanaSelector(
      this.selectors.components.PanelEditor.OptionsPane.fieldLabel('dash-row-edit Fill screen')
    ).getByRole('switch', {
      name: 'Fill screen',
      exact: true,
    });
  }

  /** Toggles the row's fill screen option */
  async toggleFillScreen() {
    await test.step('Toggle Fill screen for the row', async () => {
      // Switch inputs sit behind their labels, so target the input with force.
      await this.getFillScreenSwitch().click({ force: true });
    });
  }

  /** Returns the switch that hides the row header in view mode */
  getHideHeaderSwitch(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.Sidebar.container).getByRole('switch', {
      name: 'Hide row header',
      exact: true,
    });
  }

  /** Sets the row title */
  async setTitle(rowTitle: string) {
    await test.step(`Set row title to "${rowTitle}"`, async () => {
      const input = this.getTitleInput();
      await input.fill(rowTitle);
      await input.blur();
    });
  }

  /** Opens the variable type picker to add a variable scoped to the selected row */
  async addVariable() {
    await test.step('Add new row variable', async () => {
      await this.getByGrafanaSelector(this.selectors.components.PanelEditor.ElementEditPane.addVariableButton, {
        root: this.getByGrafanaSelector(this.selectors.components.Sidebar.container),
      }).click();
    });
  }
}
