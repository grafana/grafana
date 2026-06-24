import { test } from '@playwright/test';

import { PageObject } from '../PageObject';

// The "Add" pane content — open by default on a new dashboard,
// otherwise reached via the toolbar "Add" button
export class AddOptions extends PageObject {
  async clickNewPanelButton() {
    await test.step('Add new panel from sidebar', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.newPanelButton).click();
    });
  }
}
