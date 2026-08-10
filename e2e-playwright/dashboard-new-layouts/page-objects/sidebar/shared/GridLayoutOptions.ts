import { type Locator, test } from '@playwright/test';

import { PageObject } from '../../PageObject';

// The "layout" options group in the sidebar options pane — switches the
// element's grid between auto and custom layout, and edits the auto grid
// sizing options (min column width, max columns, row height, fill screen)
export class GridLayoutOptions extends PageObject {
  getLayoutType(layoutType: 'Auto' | 'Custom' | 'Rows' | 'Tabs'): Locator {
    return this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.Sidebar.container)
      .getByTestId(this.selectors.components.OptionsGroup.group('layout'))
      .getByLabel(`layout-selection-option-${layoutType}`);
  }

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

  getMinColumnWidthSelect(): Locator {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth
    );
  }

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

  getCustomMinColumnWidthInput(): Locator {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customMinColumnWidth
    );
  }

  async clickClearCustomMinColumnWidth() {
    await test.step('Clear custom min column width', async () => {
      await this.dashboardPage
        .getByGrafanaSelector(
          this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.clearCustomMinColumnWidth
        )
        .click();
    });
  }

  getMaxColumnsSelect(): Locator {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.maxColumns
    );
  }

  async selectMaxColumns(option: string) {
    await test.step(`Select "${option}" max columns`, async () => {
      await this.selectOption(this.getMaxColumnsSelect(), option);
    });
  }

  getRowHeightSelect(): Locator {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight
    );
  }

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

  getCustomRowHeightInput(): Locator {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customRowHeight
    );
  }

  async clickClearCustomRowHeight() {
    await test.step('Clear custom row height', async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.clearCustomRowHeight)
        .click();
    });
  }

  getFillScreenSwitch(): Locator {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.fillScreen
    );
  }

  async toggleFillScreen() {
    await test.step('Toggle fill screen', async () => {
      // force: true because the switch input is visually covered by its label
      await this.getFillScreenSwitch().click({ force: true });
    });
  }

  private async selectOption(select: Locator, option: string) {
    await select.click();
    await this.page.getByRole('listbox').getByRole('option', { name: option, exact: true }).click();
  }
}
