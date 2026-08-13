import { test } from '@playwright/test';

import { PageObject, type PageObjectArgs } from '../PageObject';

import { ConditionalRenderingOptions } from './shared/ConditionalRenderingOptions';
import { RepeatOptions } from './shared/RepeatOptions';

/**
 * The "Panel options" pane in the sidebar — title/description inputs, transparent
 * background toggle, plus the shared repeat and conditional rendering option groups
 */
export class PanelOptions extends PageObject {
  public conditionalRenderingOptions: ConditionalRenderingOptions;
  public repeatOptions: RepeatOptions;

  constructor(args: PageObjectArgs) {
    super(args);
    this.conditionalRenderingOptions = new ConditionalRenderingOptions(args);
    this.repeatOptions = new RepeatOptions(args, 'repeat-options');
  }

  /** Returns the panel title input */
  getTitleInput() {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.OptionsPane.fieldInput('Title')
    );
  }

  /** Sets the panel title */
  async setTitle(title: string) {
    await test.step(`Set panel title to "${title}"`, async () => {
      const titleInput = this.getTitleInput();
      await titleInput.fill(title);
      await titleInput.blur();
    });
  }

  /** Returns the panel description textarea */
  getDescriptionTextarea() {
    return this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.PanelEditor.OptionsPane.fieldLabel('panel-options Description'))
      .locator('textarea');
  }

  /** Toggles the panel's transparent background switch */
  async toggleTransparentBackground() {
    await test.step('Toggle transparent background', async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.Sidebar.container)
        .getByRole('switch', { name: 'Transparent background' })
        .click({ force: true });
    });
  }
}
