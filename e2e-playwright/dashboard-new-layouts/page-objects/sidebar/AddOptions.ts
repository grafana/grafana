import { test } from '@playwright/test';

import { PageObject } from '../PageObject';

/**
 * The "Add" pane content — open by default on a new dashboard,
 * otherwise reached via the toolbar "Add" button
 */
export class AddOptions extends PageObject {
  /** Adds a new panel by clicking the "Panel" button */
  async clickNewPanelButton() {
    await test.step('Add new panel from sidebar', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.newPanelButton).click();
    });
  }

  /** Adds a new tab; the button is labeled "Add tab" or "Group into tabs" depending on the current layout */
  async clickAddTabButton() {
    await test.step('Add new tab from sidebar', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.addNewTabButton).click();
    });
  }

  /** Adds a new variable by clicking the "Variable" button */
  async clickNewVariableButton() {
    await test.step('Add new variable from sidebar', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.addNewVariableButton).click();
    });
  }
}
