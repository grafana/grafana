import { type Locator, test } from '@playwright/test';

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

  /**
   * Sets the panel repeat direction (custom grid panels only)
   * @param direction Horizontal or Vertical radio label
   */
  async setRepeatDirection(direction: 'Horizontal' | 'Vertical') {
    await test.step(`Set repeat direction to "${direction}"`, async () => {
      await this.ensureExpanded();

      await this.getByGrafanaSelector(
        this.selectors.components.PanelEditor.OptionsPane.fieldLabel(`${this.groupId} Repeat direction`)
      )
        .getByRole('radio', { name: direction })
        .click({ force: true });
    });
  }

  /** Returns the "Max per row" select (custom grid panels only; hidden when direction is Vertical) */
  getMaxPerRowSelect(): Locator {
    return this.getByGrafanaSelector(
      this.selectors.components.PanelEditor.OptionsPane.fieldLabel(`${this.groupId} Max per row`)
    ).getByRole('combobox');
  }

  /**
   * Selects a max per row value (custom grid panels only; requires Horizontal direction)
   * @param value one of the preset options shown in the select
   */
  async selectMaxPerRow(value: 2 | 3 | 4 | 6 | 8 | 12) {
    await test.step(`Select max per row "${value}"`, async () => {
      await this.ensureExpanded();
      await this.getMaxPerRowSelect().click();
      await this.page
        .getByRole('listbox')
        .getByRole('option', { name: String(value), exact: true })
        .click();
    });
  }

  /** Expands the Repeat options group when it is collapsed */
  private async ensureExpanded() {
    const toggle = this.getByGrafanaSelector(this.selectors.components.OptionsGroup.toggle(this.groupId), {
      root: this.getByGrafanaSelector(this.selectors.components.Sidebar.container),
    });

    // the toggle collapses an already-open group (expanded state persists in local storage), so only click when collapsed
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      await test.step('Repeat options are collapsed, expand them', async () => {
        await toggle.click();
      });
    }
  }

  /** Selects an option in the "Repeat by variable" dropdown, expanding the options group first if collapsed */
  private async selectOption(optionLabel: string) {
    await this.ensureExpanded();

    await this.getByGrafanaSelector(
      this.selectors.components.PanelEditor.OptionsPane.fieldLabel(`${this.groupId} Repeat by variable`)
    )
      .getByRole('combobox')
      .click();

    await this.page.getByRole('listbox').getByRole('option', { name: optionLabel, exact: true }).click();
  }
}
