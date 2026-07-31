import { test } from '@playwright/test';

import { PageObject } from '../../PageObject';

export class RepeatOptions extends PageObject {
  async repeatByVariable(variableName: string) {
    await test.step(`Repeat by variable "${variableName}"`, async () => {
      await this.selectOption(variableName);
    });
  }

  async disableRepeatByVariable() {
    await test.step('Disable repeat by variable', async () => {
      await this.selectOption('Disable repeating');
    });
  }

  private async selectOption(optionLabel: string) {
    await this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.OptionsGroup.toggle('repeat-options'), {
        root: this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.container),
      })
      .click();

    await this.page.getByRole('combobox', { name: 'Repeat by variable' }).click();
    await this.page.getByRole('listbox').getByRole('option', { name: optionLabel, exact: true }).click();
  }
}
