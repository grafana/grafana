import { test, type Locator } from '@playwright/test';

import { PageObject } from './PageObject';

type ButtonName = 'copy' | 'deleteButton' | 'duplicate';

export class EditPaneHeader extends PageObject {
  getButton(name: ButtonName): Locator {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.EditPaneHeader[name]);
  }

  async clickButton(name: ButtonName, options: { confirm?: boolean } = {}) {
    const stepTitle = options.confirm
      ? `Click edit pane header button "${name}" and confirm`
      : `Click edit pane header button "${name}"`;

    await test.step(stepTitle, async () => {
      await this.getButton(name).click();

      if (options.confirm) {
        await this.dashboardPage.getByGrafanaSelector(this.selectors.pages.ConfirmModal.delete).click();
      }
    });
  }
}
