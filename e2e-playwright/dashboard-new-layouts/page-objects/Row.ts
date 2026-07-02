import { test, type Locator } from '@playwright/test';

import { PageObject } from './PageObject';

export class Row extends PageObject {
  getTitle(title: string): Locator {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.DashboardRow.title(title));
  }

  getWrapper(title: string): Locator {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.DashboardRow.wrapper(title));
  }

  getTitleInput(): Locator {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.ElementEditPane.RowsLayout.titleInput
    );
  }

  async select(title: string) {
    await test.step(`Select row "${title}"`, async () => {
      await this.getTitle(title).click();
    });
  }

  async toggle(title: string) {
    await test.step(`Toggle row "${title}"`, async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.DashboardRow.toggle(title)).click();
    });
  }
}
