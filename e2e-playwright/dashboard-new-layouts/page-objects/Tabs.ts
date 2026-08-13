import test, { type Locator } from '@playwright/test';

import { PageObject } from './PageObject';

/**
 * Tab bar of a tabs layout (top-level or nested in a row).
 * Pass `rows.getContent(...)` as `scope` to look up a tab inside a specific row.
 */
export class Tabs extends PageObject {
  /**
   * Returns the tab's title element in the tab bar
   * @param scope container to search within, defaults to the whole page
   */
  getTitle(tabTitle: string, scope?: Locator): Locator {
    // both branches resolve to the same data-testid lookup; the split only
    // determines whether the search is scoped to a given container
    return (scope ?? this.page).getByTestId(this.selectors.components.Tab.title(tabTitle));
  }

  /** Returns the layout container holding the tab's content */
  getContent(tabTitle: string): Locator {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.LayoutContainer(`tab ${tabTitle}`));
  }

  /** Selects the tab by clicking its title */
  async select(tabTitle: string) {
    await test.step(`Select tab "${tabTitle}"`, async () => {
      await this.getTitle(tabTitle).click();
    });
  }
}
