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

  /** Sets the row title */
  async setTitle(rowTitle: string) {
    await test.step(`Set row title to "${rowTitle}"`, async () => {
      const input = this.getTitleInput();
      await input.fill(rowTitle);
      await input.blur();
    });
  }
}
