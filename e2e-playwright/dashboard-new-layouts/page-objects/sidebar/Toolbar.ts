import { test, type Locator } from '@playwright/test';

import { PageObject } from '../PageObject';

// Buttons in the dashboard edit Toolbar (the icon strip). The value is the button's
// accessible name (aria-label); lookups are scoped to the sidebar container so names
// stay unambiguous. Add a button = one member of this union.
type ButtonNames = 'Add' | 'Options' | 'Code' | 'Undo' | 'Redo' | 'Outline' | 'Filters';

/** Right side toolbar with icon buttons: Add new element (+), Dashboard options (cog), Content outline, etc. */
export class Toolbar extends PageObject {
  /**
   * Returns a toolbar button
   * @param buttonName the button's accessible name (aria-label), one of the `ButtonNames` union
   */
  getButton(buttonName: ButtonNames): Locator {
    return this.getByGrafanaSelector(this.selectors.components.Sidebar.container).getByRole('button', {
      name: buttonName,
      exact: true,
    });
  }

  /**
   * Clicks a toolbar button
   * @param buttonName the button's accessible name (aria-label), one of the `ButtonNames` union
   */
  async clickButton(buttonName: ButtonNames) {
    await test.step(`Click toolbar button "${buttonName}"`, async () => {
      await this.getButton(buttonName).click();
    });
  }

  /**
   * Returns the sidebar show/hide toggle. Special case: its accessible name flips (Hide/Show)
   * and the "Show" button renders outside the container when hidden, so it's keyed on its stable testid
   */
  getVisibilityToggle(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.Sidebar.showHideToggle);
  }
}
