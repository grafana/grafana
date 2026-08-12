import { test } from '@playwright/test';

import { PageObject, type PageObjectArgs } from '../PageObject';

import { RepeatOptions } from './shared/RepeatOptions';

/**
 * The "Row options" pane in the sidebar: the row title input plus the
 * shared repeat options group
 */
export class RowOptions extends PageObject {
  readonly repeatOptions: RepeatOptions;

  constructor(args: PageObjectArgs) {
    super(args);
    this.repeatOptions = new RepeatOptions(args, 'dash-row-repeat');
  }

  /** Sets the row title */
  async setTitle(rowTitle: string) {
    await test.step(`Set row title to "${rowTitle}"`, async () => {
      const input = this.getByGrafanaSelector(
        this.selectors.components.PanelEditor.ElementEditPane.RowsLayout.titleInput
      );
      await input.fill(rowTitle);
      await input.blur();
    });
  }
}
