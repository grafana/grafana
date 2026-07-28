import { type Locator } from '@playwright/test';

import { PageObject } from './PageObject';

// A row of a rows layout in the dashboard canvas
export class Rows extends PageObject {
  getTitle(rowTitle: string): Locator {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.DashboardRow.title(rowTitle));
  }

  getWrapper(rowTitle: string): Locator {
    return this.page.getByTestId(this.selectors.components.DashboardRow.wrapper(rowTitle));
  }
}
