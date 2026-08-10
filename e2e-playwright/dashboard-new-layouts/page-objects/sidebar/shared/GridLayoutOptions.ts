import { type Locator, test } from '@playwright/test';

import { PageObject } from '../../PageObject';

/**
 * The "layout" options group in the sidebar options pane — switches the
 * element's layout between auto grid, custom grid, rows or tabs, and edits
 * the auto grid sizing options (min column width, max columns, row height, fill screen)
 */
export class GridLayoutOptions extends PageObject {
  /** Returns the layout type option in the layout selection group */
  getLayoutType(layoutType: 'Auto' | 'Custom' | 'Rows' | 'Tabs'): Locator {
    return this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.Sidebar.container)
      .getByTestId(this.selectors.components.OptionsGroup.group('layout'))
      .getByLabel(`layout-selection-option-${layoutType}`);
  }

  /**
   * Switches the element's layout to the given type
   * @param confirm when true, also confirms the switch in the confirmation modal
   */
  async switchLayout(layoutType: 'Auto' | 'Custom' | 'Rows' | 'Tabs', { confirm = false }: { confirm?: boolean } = {}) {
    const stepTitle = confirm
      ? `Switch layout to "${layoutType}" (with confirmation)`
      : `Switch layout to "${layoutType}"`;

    await test.step(stepTitle, async () => {
      await this.getLayoutType(layoutType).click();

      if (confirm) {
        // despite its name, ConfirmModal.delete is the testid of every ConfirmModal confirm button (see ConfirmContent.tsx)
        await this.dashboardPage.getByGrafanaSelector(this.selectors.pages.ConfirmModal.delete).click();
      }
    });
  }

  /** Returns the auto grid "Min column width" select */
  getMinColumnWidthSelect(): Locator {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth
    );
  }

  /**
   * Selects a min column width preset, or "Custom" with the given width
   * @param customWidth the width in pixels, only with the "Custom" option
   */
  async selectMinColumnWidth(option: 'Narrow' | 'Standard' | 'Wide'): Promise<void>;
  async selectMinColumnWidth(option: 'Custom', customWidth: number): Promise<void>;
  async selectMinColumnWidth(option: string, customWidth?: number) {
    const stepTitle =
      customWidth !== undefined
        ? `Select custom min column width of ${customWidth}`
        : `Select "${option}" min column width`;

    await test.step(stepTitle, async () => {
      await this.selectOption(this.getMinColumnWidthSelect(), option);

      if (customWidth !== undefined) {
        const input = this.getCustomMinColumnWidthInput();
        await input.fill(String(customWidth));
        await input.blur();
      }
    });
  }

  /** Returns the custom min column width input, shown when the "Custom" option is selected */
  getCustomMinColumnWidthInput(): Locator {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customMinColumnWidth
    );
  }

  /** Clears the custom min column width */
  async clickClearCustomMinColumnWidth() {
    await test.step('Clear custom min column width', async () => {
      await this.dashboardPage
        .getByGrafanaSelector(
          this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.clearCustomMinColumnWidth
        )
        .click();
    });
  }

  /** Returns the auto grid "Max columns" select */
  getMaxColumnsSelect(): Locator {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.maxColumns
    );
  }

  /** Selects a max columns option */
  async selectMaxColumns(option: string) {
    await test.step(`Select "${option}" max columns`, async () => {
      await this.selectOption(this.getMaxColumnsSelect(), option);
    });
  }

  /** Returns the auto grid "Row height" select */
  getRowHeightSelect(): Locator {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight
    );
  }

  /**
   * Selects a row height preset, or "Custom" with the given height
   * @param customHeight the height in pixels, only with the "Custom" option
   */
  async selectRowHeight(option: 'Short' | 'Standard' | 'Tall'): Promise<void>;
  async selectRowHeight(option: 'Custom', customHeight: number): Promise<void>;
  async selectRowHeight(option: string, customHeight?: number) {
    const stepTitle =
      customHeight !== undefined ? `Select custom row height of ${customHeight}` : `Select "${option}" row height`;

    await test.step(stepTitle, async () => {
      await this.selectOption(this.getRowHeightSelect(), option);

      if (customHeight !== undefined) {
        const input = this.getCustomRowHeightInput();
        await input.fill(String(customHeight));
        await input.blur();
      }
    });
  }

  /** Returns the custom row height input, shown when the "Custom" option is selected */
  getCustomRowHeightInput(): Locator {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customRowHeight
    );
  }

  /** Clears the custom row height */
  async clickClearCustomRowHeight() {
    await test.step('Clear custom row height', async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.clearCustomRowHeight)
        .click();
    });
  }

  /** Returns the auto grid "Fill screen" switch */
  getFillScreenSwitch(): Locator {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.fillScreen
    );
  }

  /** Toggles the fill screen switch */
  async toggleFillScreen() {
    await test.step('Toggle fill screen', async () => {
      // force: true because the switch input is visually covered by its label
      await this.getFillScreenSwitch().click({ force: true });
    });
  }

  /** Opens the given select and picks an option in its listbox */
  private async selectOption(select: Locator, option: string) {
    await select.click();
    await this.page.getByRole('listbox').getByRole('option', { name: option, exact: true }).click();
  }
}
