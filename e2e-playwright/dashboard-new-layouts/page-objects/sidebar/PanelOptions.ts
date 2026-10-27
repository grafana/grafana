import { type Locator, test } from '@playwright/test';

import { PageObject, type PageObjectArgs } from '../PageObject';

import { ConditionalRenderingOptions } from './shared/ConditionalRenderingOptions';
import { RepeatOptions } from './shared/RepeatOptions';

/**
 * The "Panel options" pane in the sidebar — title/description inputs, transparent
 * background toggle, plus the shared repeat and conditional rendering option groups
 */
export class PanelOptions extends PageObject {
  readonly conditionalRenderingOptions: ConditionalRenderingOptions;
  readonly repeatOptions: RepeatOptions;

  constructor(
    args: PageObjectArgs,
    private readonly container = args.getByGrafanaSelector(args.selectors.components.Sidebar.container)
  ) {
    super(args);
    this.conditionalRenderingOptions = new ConditionalRenderingOptions(args, container);
    this.repeatOptions = new RepeatOptions(args, 'repeat-options', container);
  }

  /** Returns the panel title input */
  getTitleInput(): Locator {
    return this.container.getByTestId(this.selectors.components.PanelEditor.OptionsPane.fieldInput('Title'));
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
  getDescriptionTextarea(): Locator {
    return this.container
      .getByTestId(this.selectors.components.PanelEditor.OptionsPane.fieldLabel('Panel options Description'))
      .locator('textarea');
  }

  getSubtitleSwitch() {
    return this.container.getByTestId(this.selectors.components.PanelEditor.OptionsPane.fieldLabel('subtitle-switch'));
  }

  getSubtitleInput(): Locator {
    return this.container.getByRole('switch', { name: /Use as subtitle/ });
  }

  getTransparentBackgroundSwitch(): Locator {
    return this.container.getByRole('switch', { name: 'Transparent background', exact: true });
  }

  async editVisualization() {
    await test.step('Open the visualization editor', async () => {
      await this.container.getByRole('button', { name: 'Edit visualization', exact: true }).click();
    });
  }

  /** Toggles the panel's transparent background switch */
  async toggleTransparentBackground() {
    await test.step('Toggle transparent background', async () => {
      await this.getTransparentBackgroundSwitch().click({ force: true });
    });
  }
}
