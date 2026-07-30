import { test } from '@playwright/test';

import { PageObject } from '../PageObject';

export class DashboardOptions extends PageObject {
  getTitleInput() {
    return this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.PanelEditor.OptionsPane.fieldLabel('dashboard-options Title'))
      .locator('input');
  }

  getDescriptionTextarea() {
    return this.dashboardPage
      .getByGrafanaSelector(
        this.selectors.components.PanelEditor.OptionsPane.fieldLabel('dashboard-options Description')
      )
      .locator('textarea');
  }

  async switchLayout(layoutType: 'auto' | 'custom', { confirm = false }: { confirm?: boolean } = {}) {
    const stepTitle = confirm
      ? `Switch layout to ${layoutType} grid (with confirmation)`
      : `Switch layout to ${layoutType} grid`;

    await test.step(stepTitle, async () => {
      const layoutGroup = this.dashboardPage.getByGrafanaSelector(
        this.selectors.components.OptionsGroup.group('layout'),
        { root: this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.container) }
      );

      // the option's aria-label is layout-selection-option-<layout name>, with the name capitalized
      const optionName = layoutType === 'auto' ? 'Auto' : 'Custom';
      await layoutGroup.getByLabel(`layout-selection-option-${optionName}`).click();

      if (confirm) {
        // despite its name, ConfirmModal.delete is the testid of every ConfirmModal confirm button (see ConfirmContent.tsx)
        await this.dashboardPage.getByGrafanaSelector(this.selectors.pages.ConfirmModal.delete).click();
      }
    });
  }
}
