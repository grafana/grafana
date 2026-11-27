import { test, type Locator } from '@playwright/test';

import { PageObject } from '../PageObject';

/**
 * The "Add" pane content — open by default on a new dashboard,
 * otherwise reached via the toolbar "Add" button
 */
export class AddOptions extends PageObject {
  /** Returns the "Panel" button, which adds a new panel when clicked or dragged onto the canvas */
  getNewPanelButton(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.Sidebar.newPanelButton);
  }

  /** Returns the "Paste panel" button, only rendered while a copied panel is in the clipboard */
  getPastePanelButton(): Locator {
    // the native <button>: its draggable wrapper may also expose the "Paste panel" button role
    return this.getByGrafanaSelector(this.selectors.components.Sidebar.container)
      .locator('button')
      .filter({ hasText: /^Paste panel$/ });
  }

  /** Adds a new panel by clicking the "Panel" button */
  async addPanel() {
    await test.step('Add new panel from sidebar', async () => {
      await this.getNewPanelButton().click();
    });
  }

  /** Adds a new tab; the button is labeled "Add tab" or "Group into tabs" depending on the current layout */
  async addTab() {
    await test.step('Add new tab from sidebar', async () => {
      await this.getByGrafanaSelector(this.selectors.components.Sidebar.addNewTabButton).click();
    });
  }

  /** Adds a new variable by clicking the "Variable" button */
  async addVariable() {
    await test.step('Add new variable from sidebar', async () => {
      await this.getByGrafanaSelector(this.selectors.components.Sidebar.addNewVariableButton).click();
    });
  }

  async addFilter() {
    await test.step('Add Filter and Group by from sidebar', async () => {
      await this.getByGrafanaSelector(this.selectors.components.Sidebar.container)
        .getByRole('button', { name: 'Filter and Group by', exact: true })
        .click();
    });
  }
}
