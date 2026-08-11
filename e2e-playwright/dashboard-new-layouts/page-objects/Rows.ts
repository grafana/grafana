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

  /** Selects the row by clicking its title */
  async select(rowTitle: string) {
    await test.step(`Select row "${rowTitle}"`, async () => {
      await this.getTitle(rowTitle).click();
    });
  }

  /** Collapses an expanded row, expands a collapsed one */
  async toggle(rowTitle: string) {
    await test.step(`Toggle row "${rowTitle}"`, async () => {
      await this.getByGrafanaSelector(this.selectors.components.DashboardRow.toggle(rowTitle)).click();
    });
  }
}
