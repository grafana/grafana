import { test, type Locator } from '@playwright/test';

import { PageObject } from './PageObject';

// Controls above the dashboard: timepicker, refresh button, edit button, save button
export class Controls extends PageObject {
  private getEditButton(label: RegExp): Locator {
    return this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.NavToolbar.editDashboard.editButton)
      .filter({ hasText: label });
  }

  async enterEditMode() {
    await test.step('Enter edit mode', async () => {
      await this.getEditButton(/^Edit$/).click();
    });
  }

  async exitEditMode() {
    await test.step('Exit edit mode', async () => {
      await this.getEditButton(/^Exit edit$/).click();
    });
  }

  async saveDashboard(title?: string) {
    await test.step(title ? `Save dashboard with title "${title}"` : 'Save dashboard', async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.NavToolbar.editDashboard.saveButton)
        .click();

      if (title) {
        await this.page.getByTestId(this.selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput).fill(title);
      }

      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.Drawer.DashboardSaveDrawer.saveButton)
        .click();
    });
  }

  async openControlsMenu() {
    await test.step('Open controls menu', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.pages.Dashboard.ControlsButton).click();
    });
  }

  readonly variables = {
    getLabel: (variableLabel: string): Locator =>
      this.dashboardPage.getByGrafanaSelector(this.selectors.pages.Dashboard.SubMenu.submenuItemLabels(variableLabel)),
    getDropdownTrigger: (variableLabel: string): Locator => {
      // the trigger is the next sibling of its label
      return this.variables.getLabel(variableLabel).locator('+ *');
    },
    openDropdown: async (variableLabel: string) => {
      await test.step(`Open dropdown of variable "${variableLabel}"`, async () => {
        await this.variables.getDropdownTrigger(variableLabel).click();
      });
    },
    getOption: (optionLabel: string): Locator => this.page.getByRole('option', { name: optionLabel, exact: true }),
    selectOption: async (variableLabel: string, optionLabel: string) => {
      await test.step(`Select option "${optionLabel}" of variable "${variableLabel}"`, async () => {
        await this.variables.openDropdown(variableLabel);
        await this.variables.getOption(optionLabel).click();
      });
    },
    addFilter: async (variableLabel: string, filter: [string, string, string]) => {
      await test.step(`Add filter "${filter[0]}${filter[1]}\"${filter[2]}\"" to variable "${variableLabel}"`, async () => {
        await this.variables.openDropdown(variableLabel);

        await this.page.getByRole('option', { name: filter[0], exact: true }).click();
        await this.page.getByRole('option', { name: new RegExp(`^${filter[1]} `) }).click();
        await this.page.getByRole('option', { name: filter[2], exact: true }).click();
      });
    },
    getInput: (variableLabel: string): Locator => {
      // the input has no selector of its own: like the dropdown trigger, it lives in the label's next sibling
      return this.variables.getLabel(variableLabel).locator('+ *').locator('input');
    },
  };
}
