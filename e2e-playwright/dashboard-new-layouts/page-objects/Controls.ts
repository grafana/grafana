import { test, type Locator } from '@playwright/test';

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

  // Same control as enterEditMode: while editing, the edit button acts as "Exit edit"
  async exitEditMode() {
    await test.step('Exit edit mode', async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.NavToolbar.editDashboard.editButton)
        .click();
    });
  }

  readonly variables = {
    getLabel: (variableLabel: string): Locator => {
      return this.dashboardPage.getByGrafanaSelector(
        this.selectors.pages.Dashboard.SubMenu.submenuItemLabels(variableLabel)
      );
    },
    openDropdown: async (variableLabel: string) => {
      await test.step(`Open dropdown of variable "${variableLabel}"`, async () => {
        // The variable value control is the next sibling of its label
        await this.variables.getLabel(variableLabel).locator('+ *').click();
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
  };
}
