import { test } from '@playwright/test';

import { PageObject } from '../PageObject';

export class PanelOptions extends PageObject {
  getTitleInput() {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.OptionsPane.fieldInput('Title')
    );
  }

  async setTitle(title: string) {
    await test.step(`Set panel title to "${title}"`, async () => {
      await this.getTitleInput().fill(title);
    });
  }

  getDescriptionTextarea() {
    return this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.PanelEditor.OptionsPane.fieldLabel('Panel options Description'))
      .locator('textarea');
  }

  getSubtitleSwitch() {
    return this.dashboardPage.getByGrafanaSelector(
      this.selectors.components.PanelEditor.OptionsPane.fieldLabel('subtitle-switch')
    );
  }

  async toggleTransparentBackground() {
    await test.step('Toggle transparent background', async () => {
      await this.page.getByRole('switch', { name: 'Transparent background' }).click({ force: true });
    });
  }
}
