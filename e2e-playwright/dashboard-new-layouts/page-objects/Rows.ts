import { type Locator, test } from '@playwright/test';

import { PageObject } from './PageObject';

/** A row of a rows layout in the dashboard canvas */
export class Rows extends PageObject {
  /** Returns the row's title element in the row header */
  getTitle(rowTitle: string): Locator {
    return this.getByGrafanaSelector(this.selectors.components.DashboardRow.title(rowTitle));
  }

  /** Returns the row's content wrapper (grid or nested tabs) right after the row header */
  getContent(rowTitle: string): Locator {
    // The row's content (grid or nested tabs) is the direct sibling right after the
    // row header, inside the row wrapper.
    // Note: it's not LayoutContainer(`row ...`): that testid
    // only exists when the row's body is a grid, never when it hosts a tabs layout.
    return this.page
      .getByTestId(this.selectors.components.DashboardRow.wrapper(rowTitle))
      .locator('> .dashboard-row-header + div');
  }

  /**
   * Selects a row by clicking its title; an array extends the selection via shift-clicks
   * @param rowTitle a string to select one row, an array of them to multi-select
   */
  async select(rowTitle: string | string[]) {
    if (!Array.isArray(rowTitle)) {
      await test.step(`Select row "${rowTitle}"`, async () => {
        await this.getTitle(rowTitle).click();
      });
    } else {
      await test.step(`Select multiple rows: ${rowTitle.join(', ')}`, async () => {
        for (const [index, title] of rowTitle.entries()) {
          // first click selects; subsequent shift-clicks extend the multi-selection
          await this.getTitle(title).click(index === 0 ? undefined : { modifiers: ['Shift'] });
        }
      });
    }
  }

  /** Collapses an expanded row, expands a collapsed one */
  async toggle(rowTitle: string) {
    await test.step(`Toggle row "${rowTitle}"`, async () => {
      await this.getByGrafanaSelector(this.selectors.components.DashboardRow.toggle(rowTitle)).click();
    });
  }
}
