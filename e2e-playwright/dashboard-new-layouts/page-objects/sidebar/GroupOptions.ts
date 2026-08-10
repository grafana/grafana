import { test, type Locator } from '@playwright/test';

import { PageObject } from '../PageObject';

// The "Group" category of the sidebar options pane, shown when several panels,
// rows or tabs are selected. The buttons have no testid of their own, so they are
// resolved by accessible name, scoped to the sidebar container.
export class GroupOptions extends PageObject {
  getGroupIntoButton(target: 'row' | 'tab'): Locator {
    return this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.Sidebar.container)
      .getByRole('button', { name: target === 'row' ? 'Group into row' : 'Group into tab' });
  }

  async clickGroupIntoButton(target: 'row' | 'tab') {
    await test.step(`Click "Group into ${target}" in sidebar`, async () => {
      await this.getGroupIntoButton(target).click();
    });
  }
}
