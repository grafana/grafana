import { test } from '@playwright/test';

import { PageObject } from './PageObject';

// A dashboard panel: header, title, and selection within the edit canvas
export class Panel extends PageObject {
  getHeaderByTitle(title: string | RegExp) {
    return this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.Panels.Panel.headerContainer)
      .filter({ hasText: title })
      .first();
  }

  async selectByTitle(title: string | RegExp) {
    await test.step(`Select panel "${title}"`, async () => {
      await this.getHeaderByTitle(title).click();
    });
  }

  async deselectAll() {
    await test.step('Deselect all panels', async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.pages.Dashboard.Controls)
        .click({ position: { x: 0, y: 0 } });
    });
  }
}
