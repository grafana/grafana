import { test, type Locator } from '@playwright/test';

import { PageObject } from './PageObject';

type ActionName =
  | 'addPanel'
  | 'addRow'
  | 'addTab'
  | 'groupPanels'
  | 'pasteRow'
  | 'pasteTab'
  | 'ungroup'
  | 'ungroupRows';

export class CanvasGridAddActions extends PageObject {
  getAction(name: ActionName): Locator {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.CanvasGridAddActions[name]);
  }

  async clickAction(name: ActionName) {
    await test.step(`Click canvas grid action "${name}"`, async () => {
      await this.getAction(name).click();
    });
  }

  async clickLastAction(name: ActionName) {
    await test.step(`Click last canvas grid action "${name}"`, async () => {
      await this.getAction(name).last().click();
    });
  }
}
