import { type Locator } from '@playwright/test';

import { PageObject } from './PageObject';

// A row of a rows layout in the dashboard canvas
export class Rows extends PageObject {
  getTitle(rowTitle: string): Locator {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.DashboardRow.title(rowTitle));
  }

  getContent(rowTitle: string): Locator {
    // The row's content (grid or nested tabs) is the direct sibling right after the
    // row header, inside the row wrapper.
    // Note: it's not LayoutContainer(`row ...`): that testid
    // only exists when the row's body is a grid, never when it hosts a tabs layout.
    return this.page
      .getByTestId(this.selectors.components.DashboardRow.wrapper(rowTitle))
      .locator('> .dashboard-row-header + div');
  }
}
