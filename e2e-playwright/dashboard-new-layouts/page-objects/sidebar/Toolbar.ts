import { test, type Locator } from '@playwright/test';

import { PageObject } from '../PageObject';

// Buttons in the dashboard edit Toolbar (the icon strip). The value is the button's
// accessible name (aria-label); lookups are scoped to the sidebar container so names
// stay unambiguous. Add a button = one member of this union.
type ButtonNames = 'Add' | 'Options' | 'Code' | 'Undo' | 'Redo' | 'Outline' | 'Filters';

// Right side toolbar with icon buttons: Add new element (+), Dashboard options (cog), Content outline, etc.
export class Toolbar extends PageObject {
  getButton(name: ButtonNames): Locator {
    return this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.Sidebar.container)
      .getByRole('button', { name, exact: true });
  }

  async clickButton(name: ButtonNames) {
    await test.step(`Click toolbar button "${name}"`, async () => {
      await this.getButton(name).click();
    });
  }

  // Special case: the show/hide toggle's accessible name flips (Hide/Show) and the "Show"
  // button renders outside the container when hidden — so it's keyed on its stable testid
  getVisibilityToggle(): Locator {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.showHideToggle);
  }
}
