import { test } from '@playwright/test';

import { PageObject } from './PageObject';

// Controls above the dashboard: timepicker, refresh button, edit button, save button
export class Controls extends PageObject {
  async enterEditMode() {
    await test.step('Enter edit mode', async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.NavToolbar.editDashboard.editButton)
        .click();
    });
  }
}
