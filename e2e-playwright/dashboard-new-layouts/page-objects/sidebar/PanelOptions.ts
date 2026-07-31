import { test } from '@playwright/test';

import { PageObject, type PageObjectArgs } from '../PageObject';

import { ConditionalRenderingOptions } from './shared/ConditionalRenderingOptions';
import { RepeatOptions } from './shared/RepeatOptions';

export class PanelOptions extends PageObject {
  public conditionalRenderingOptions: ConditionalRenderingOptions;
  public repeatOptions: RepeatOptions;

  constructor(args: PageObjectArgs) {
    super(args);
    this.conditionalRenderingOptions = new ConditionalRenderingOptions(args);
    this.repeatOptions = new RepeatOptions(args);
  }

  getTitleInput() {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.OptionsPane.fieldInput('Title')
    );
  }

  async setTitle(title: string) {
    await test.step(`Set panel title to "${title}"`, async () => {
      const titleInput = this.getTitleInput();
      await titleInput.fill(title);
      await titleInput.blur();
    });
  }

  getDescriptionTextarea() {
    return this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.PanelEditor.OptionsPane.fieldLabel('panel-options Description'))
      .locator('textarea');
  }

  async toggleTransparentBackground() {
    await test.step('Toggle transparent background', async () => {
      await this.page.getByRole('switch', { name: 'Transparent background' }).click({ force: true });
    });
  }
}
