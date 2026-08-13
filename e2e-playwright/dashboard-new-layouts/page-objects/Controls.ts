import { test, type Locator } from '@playwright/test';

import { PageObject } from './PageObject';

/** Controls above the dashboard: timepicker, refresh button, edit button, save button, share menu, and the variables submenu */
export class Controls extends PageObject {
  /** Returns the controls container above the dashboard */
  getContainer(): Locator {
    return this.getByGrafanaSelector(this.selectors.pages.Dashboard.Controls);
  }

  /** Returns the edit-mode toolbar button matching the given label ("Edit" or "Exit edit") */
  private getEditButton(buttonLabel: RegExp): Locator {
    return this.getByGrafanaSelector(this.selectors.components.NavToolbar.editDashboard.editButton).filter({
      hasText: buttonLabel,
    });
  }

  /** Enters dashboard edit mode by clicking the "Edit" button */
  async enterEditMode() {
    await test.step('Enter edit mode', async () => {
      await this.getEditButton(/^Edit$/).click();
    });
  }

  /** Exits dashboard edit mode by clicking the "Exit edit" button */
  async exitEditMode() {
    await test.step('Exit edit mode', async () => {
      await this.getEditButton(/^Exit edit$/).click();
    });
  }

  /**
   * Saves the dashboard through the save drawer
   * @param dashboardTitle when provided, fills the save-as title input before saving
   */
  async saveDashboard(dashboardTitle?: string) {
    await test.step(dashboardTitle ? `Save dashboard with title "${dashboardTitle}"` : 'Save dashboard', async () => {
      await this.getByGrafanaSelector(this.selectors.components.NavToolbar.editDashboard.saveButton).click();

      if (dashboardTitle) {
        await this.page
          .getByTestId(this.selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput)
          .fill(dashboardTitle);
      }

      await this.getByGrafanaSelector(this.selectors.components.Drawer.DashboardSaveDrawer.saveButton).click();
    });
  }

  /** Opens the share snapshot drawer via the share button's arrow menu */
  async openShareSnapshotDrawer() {
    await test.step('Open share snapshot drawer', async () => {
      await this.getByGrafanaSelector(this.selectors.pages.Dashboard.DashNav.newShareButton.arrowMenu).click();
      await this.getByGrafanaSelector(this.selectors.pages.Dashboard.DashNav.newShareButton.menu.shareSnapshot).click();
    });
  }

  /** Returns to the dashboard by clicking the "Back to dashboard" button in the edit toolbar */
  async goBackToDashboard() {
    await test.step('Go back to dashboard', async () => {
      await this.getByGrafanaSelector(this.selectors.components.NavToolbar.editDashboard.backToDashboardButton).click();
    });
  }

  /** Opens the dashboard controls menu */
  async openControlsMenu() {
    await test.step('Open controls menu', async () => {
      await this.getByGrafanaSelector(this.selectors.pages.Dashboard.ControlsButton).click();
    });
  }

  readonly timeRange = {
    /** Sets an absolute time range through the timepicker's from/to fields */
    set: async (from: string, to: string) => {
      await test.step(`Set time range from "${from}" to "${to}"`, async () => {
        await this.getByGrafanaSelector(this.selectors.components.TimePicker.openButton).click();
        const fromField = this.getByGrafanaSelector(this.selectors.components.TimePicker.fromField);
        await fromField.click();
        await fromField.fill(from);
        const toField = this.getByGrafanaSelector(this.selectors.components.TimePicker.toField);
        await toField.click();
        await toField.fill(to);
        await this.getByGrafanaSelector(this.selectors.components.TimePicker.applyTimeRange).click();
      });
    },
    /** Selects a time range preset (e.g. "Last 6 hours") from the timepicker overlay */
    selectPreset: async (presetLabel: string) => {
      await test.step(`Select time range preset "${presetLabel}"`, async () => {
        await this.getByGrafanaSelector(this.selectors.components.TimePicker.openButton).click();
        await this.getByGrafanaSelector(this.selectors.components.TimePicker.overlayContent)
          .getByText(presetLabel)
          .click();
      });
    },
  };

  readonly variables = {
    /** Returns the variable's label in the submenu */
    getLabel: (variableLabel: string): Locator =>
      this.getByGrafanaSelector(this.selectors.pages.Dashboard.SubMenu.submenuItemLabels(variableLabel)),
    /** Returns the variable's dropdown trigger */
    getDropdownTrigger: (variableLabel: string): Locator => {
      // the trigger is the next sibling of its label
      return this.variables.getLabel(variableLabel).locator('+ *');
    },
    /** Returns the variable's value input */
    getInput: (variableLabel: string): Locator => {
      // the input has no selector of its own: like the dropdown trigger, it lives in the label's next sibling
      return this.variables.getLabel(variableLabel).locator('+ *').locator('input');
    },
    /** Returns the dropdown option with the given label (the dropdown must be open) */
    getOption: (optionLabel: string): Locator => this.page.getByRole('option', { name: optionLabel, exact: true }),
    /** Opens the variable's dropdown by clicking its input */
    openDropdown: async (variableLabel: string) => {
      await test.step(`Open dropdown of variable "${variableLabel}"`, async () => {
        // clicking the input itself and not the trigger avoids the value chips and clear icon
        await this.variables.getInput(variableLabel).click();
      });
    },
    /** Selects an option in the variable's dropdown; throws if a multi-value option is already selected */
    selectOption: async (variableLabel: string, optionLabel: string) => {
      await test.step(`Select option "${optionLabel}" of variable "${variableLabel}"`, async () => {
        await this.variables.openDropdown(variableLabel);
        const option = this.variables.getOption(optionLabel);

        // ensure options are rendered before inspecting the checkbox (locator.count below does not wait)
        await option.waitFor();

        // multi-value options render a checkbox, we throw if already selected so we don't toggle it off
        const checkbox = option.getByRole('checkbox');
        if ((await checkbox.count()) > 0 && (await checkbox.isChecked())) {
          throw new Error(
            `Cannot select option "${optionLabel}" of variable "${variableLabel}": it is already selected`
          );
        }

        await option.click();
      });
    },
    /** Deselects an option of a multi-value variable (options rendered as checkboxes); throws if it is not selected */
    deselectOption: async (variableLabel: string, optionLabel: string) => {
      await test.step(`Deselect option "${optionLabel}" of variable "${variableLabel}"`, async () => {
        await this.variables.openDropdown(variableLabel);

        const option = this.variables.getOption(optionLabel);
        if (!(await option.getByRole('checkbox').isChecked())) {
          throw new Error(`Cannot deselect option "${optionLabel}" of variable "${variableLabel}": it is not selected`);
        }

        await option.click();
      });
    },
    /** Sets the variable's value by typing into its input and pressing Enter */
    setValue: async (variableLabel: string, text: string) => {
      await test.step(`Set value of variable "${variableLabel}" to "${text}"`, async () => {
        const input = this.variables.getInput(variableLabel);
        await input.click();
        await input.clear();
        await input.fill(text);
        await input.press('Enter');
      });
    },
    /**
     * Adds a filter to an ad hoc filters variable
     * @param filter a [label, operator, value] tuple
     */
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
