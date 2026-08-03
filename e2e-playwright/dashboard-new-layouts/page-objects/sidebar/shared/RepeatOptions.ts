import { test } from '@playwright/test';

import { PageObject } from '../../PageObject';

// The collapsible "Repeat options" group in the sidebar options pane —
// shared by panels, rows, and tabs to repeat the element by a template variable
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
    const toggle = this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.OptionsGroup.toggle('repeat-options'),
      {
        root: this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.container),
      }
    );

    // the toggle collapses an already-open group (expanded state persists in local storage), so only click when collapsed
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      await test.step('Repeat options are collapsed, expand them', async () => {
        await toggle.click();
      });
    }

    await this.dashboardPage
      .getByGrafanaSelector(
        this.selectors.components.PanelEditor.OptionsPane.fieldLabel('repeat-options Repeat by variable')
      )
      .getByRole('combobox')
      .click();

    await this.page.getByRole('listbox').getByRole('option', { name: optionLabel, exact: true }).click();
  }
}
