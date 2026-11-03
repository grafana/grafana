import { type Locator, test } from '@playwright/test';

import { PageObject, type PageObjectArgs } from '../PageObject';

import { ConditionalRenderingOptions } from './shared/ConditionalRenderingOptions';
import { RepeatOptions } from './shared/RepeatOptions';

/**
 * The "Tab options" pane in the sidebar — currently just composes the
 * shared repeat and conditional rendering option groups
 */
export class TabOptions extends PageObject {
  readonly conditionalRenderingOptions: ConditionalRenderingOptions;
  readonly repeatOptions: RepeatOptions;

  constructor(args: PageObjectArgs) {
    super(args);
    this.conditionalRenderingOptions = new ConditionalRenderingOptions(args);
    this.repeatOptions = new RepeatOptions(args, 'repeat-options');
  }

  /** Returns the tab title input */
  getTitleInput(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.PanelEditor.ElementEditPane.TabsLayout.titleInput);
  }

  /** Sets the tab title */
  async setTitle(tabTitle: string) {
    await test.step(`Set tab title to "${tabTitle}"`, async () => {
      const titleInput = this.getTitleInput();
      await titleInput.fill(tabTitle);
      await titleInput.blur();
    });
  }

  /** Opens the variable type picker to add a variable scoped to the selected tab */
  async addVariable() {
    await test.step('Add new tab variable', async () => {
      await this.getByGrafanaSelector(this.selectors.components.PanelEditor.ElementEditPane.addVariableButton, {
        root: this.getByGrafanaSelector(this.selectors.components.Sidebar.container),
      }).click();
    });
  }
}
