import { test } from '@playwright/test';

import { PageObject } from './PageObject';

// Right side toolbar with icon buttons: Add new element (+), Dashboard options (cog), Content outline, etc.
export class Toolbar extends PageObject {
  async openDashboardOptions() {
    await test.step('Open dashboard options', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.pages.Dashboard.Sidebar.optionsButton).click();
    });
  }
}
