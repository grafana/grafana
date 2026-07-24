import { type Locator } from '@playwright/test';

import { PageObject } from './PageObject';

// Tab bar of a tabs layout (top-level or nested in a row)
export class Tabs extends PageObject {
  getTab(tabTitle: string, scope?: Locator): Locator {
    // both branches resolve to the same data-testid lookup; the split only
    // determines whether the search is scoped to a given container
    return (scope ?? this.page).getByTestId(this.selectors.components.Tab.title(tabTitle));
  }
}
