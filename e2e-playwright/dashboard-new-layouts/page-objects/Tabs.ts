import test, { type Locator } from '@playwright/test';

import { PageObject } from './PageObject';

// Tab bar of a tabs layout (top-level or nested in a row)
export class Tabs extends PageObject {
  getTitle(tabTitle: string, scope?: Locator): Locator {
    // both branches resolve to the same data-testid lookup; the split only
    // determines whether the search is scoped to a given container
    return (scope ?? this.page).getByTestId(this.selectors.components.Tab.title(tabTitle));
  }
  getContent(tabTitle: string): Locator {
    // the layout container holding the tab's content
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.LayoutContainer(`tab ${tabTitle}`));
  }
  async select(tabTitle: string) {
    await test.step(`Select tab "${tabTitle}"`, async () => {
      await this.getTitle(tabTitle).click();
    });
  }
}
