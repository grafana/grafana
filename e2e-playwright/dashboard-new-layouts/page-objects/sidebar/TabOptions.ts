import { test } from '@playwright/test';

import { PageObject, type PageObjectArgs } from '../PageObject';

import { ConditionalRenderingOptions } from './shared/ConditionalRenderingOptions';
import { RepeatOptions } from './shared/RepeatOptions';

// The "Tab options" pane in the sidebar — currently just composes the
// shared repeat and conditional rendering option groups
export class TabOptions extends PageObject {
  public conditionalRenderingOptions: ConditionalRenderingOptions;
  public repeatOptions: RepeatOptions;

  constructor(args: PageObjectArgs) {
    super(args);
    this.conditionalRenderingOptions = new ConditionalRenderingOptions(args);
    this.repeatOptions = new RepeatOptions(args, 'repeat-options');
  }

  async setTitle(tabTitle: string) {
    await test.step(`Set tab title to "${tabTitle}"`, async () => {
      const titleInput = this.dashboardPage.getByGrafanaSelector(
        this.selectors.components.PanelEditor.ElementEditPane.TabsLayout.titleInput
      );
      await titleInput.fill(tabTitle);
      await titleInput.blur();
    });
  }

  async setTitle(tabTitle: string) {
    await test.step(`Set tab title to "${tabTitle}"`, async () => {
      const titleInput = this.dashboardPage.getByGrafanaSelector(
        this.selectors.components.PanelEditor.ElementEditPane.TabsLayout.titleInput
      );
      await titleInput.fill(tabTitle);
      await titleInput.blur();
    });
  }
}
