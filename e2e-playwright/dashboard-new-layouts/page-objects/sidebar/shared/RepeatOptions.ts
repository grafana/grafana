import { test } from '@playwright/test';

import { PageObject, type PageObjectArgs } from '../../PageObject';

/**
 * The collapsible "Repeat options" group in the sidebar options pane —
 * shared by panels, rows, and tabs to repeat the element by a template variable
 */
export class RepeatOptions extends PageObject {
  constructor(
    args: PageObjectArgs,
    // Options-group id, prefixes both the group's toggle testid and the 'Repeat by
    // variable' field label. Set by the editors in public/app/features/dashboard-scene/scene/:
    // 'repeat-options' in layout-default/DashboardGridItemEditor.tsx,
    // layout-auto-grid/AutoGridItemEditor.tsx and layout-tabs/TabItemEditor.tsx;
    // 'dash-row-repeat' in layout-rows/RowItemEditor.tsx
    private readonly groupId: 'repeat-options' | 'dash-row-repeat'
  ) {
    super(args);
  }

  /** Repeats the element by the given template variable */
  async repeatByVariable(variableName: string) {
    await test.step(`Repeat by variable "${variableName}"`, async () => {
      await this.selectOption(variableName);
    });
  }

  /** Disables the element's repetition */
  async disableRepeatByVariable() {
    await test.step('Disable repeat by variable', async () => {
      await this.selectOption('Disable repeating');
    });
  }

  /** Selects an option in the "Repeat by variable" dropdown, expanding the options group first if collapsed */
  private async selectOption(optionLabel: string) {
    const toggle = this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.OptionsGroup.toggle(this.groupId),
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
        this.selectors.components.PanelEditor.OptionsPane.fieldLabel(`${this.groupId} Repeat by variable`)
      )
      .getByRole('combobox')
      .click();

    await this.page.getByRole('listbox').getByRole('option', { name: optionLabel, exact: true }).click();
  }
}
