import { test, type Locator } from '@playwright/test';

import { PageObject } from './PageObject';

// Tab bar of a tabs layout (top-level or nested in a row)
export class Tabs extends PageObject {
  getTab(tabTitle: string, scope?: Locator): Locator {
    // both branches resolve to the same data-testid lookup; the split only
    // determines whether the search is scoped to a given container
    return (scope ?? this.page).getByTestId(this.selectors.components.Tab.title(tabTitle));
  }

  // The "New tab" button in the tab bar's edit controls. It shares its testid with the
  // "Group into tab" item of the canvas add-actions menu, so it only resolves
  // unambiguously once a tabs layout exists and that menu is closed.
  getAddTabButton(): Locator {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.CanvasGridAddActions.addTab);
  }

  async clickAddTab() {
    await test.step('Add new tab', async () => {
      await this.getAddTabButton().click();
    });
  }

  // Overflow controls, rendered only when the tabs are too wide for the tab bar.
  // Keyed on the accessible name — they have no testid of their own.
  getScrollButton(direction: 'left' | 'right'): Locator {
    return this.page.getByRole('button', { name: `Scroll tabs ${direction}` });
  }
}
