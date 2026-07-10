import { test, type Locator } from '@playwright/test';

import { PageObject } from './PageObject';

export class Tab extends PageObject {
  getTitle(title: string): Locator {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Tab.title(title));
  }

  getTitleInput(): Locator {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.ElementEditPane.TabsLayout.titleInput
    );
  }

  async select(title: string) {
    await test.step(`Select tab "${title}"`, async () => {
      await this.getTitle(title).click();
    });
  }
}
