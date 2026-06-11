import { test } from '@playwright/test';

import { PageObject } from '../PageObject';

// The "Content outline" pane — tree of dashboard elements (panels, variables, ...)
export class ContentOutline extends PageObject {
  async clickItem(name: string) {
    await test.step(`Click outline item "${name}"`, async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.PanelEditor.Outline.item(name)).click();
    });
  }
}
