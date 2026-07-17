import { test } from '@playwright/test';

import { PageObject } from './PageObject';

// A dashboard panel: header, title, and selection within the edit canvas
export class Panel extends PageObject {
  getContainerByTitle(title: string) {
    // despite the Panel.title() naming, this data-testid is on the whole
    // panel <section> container, not the title text or header bar.
    // see PanelChrome.tsx and packages/grafana-e2e-selectors/src/selectors/components.ts
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Panels.Panel.title(title));
  }

  getHeaderByTitle(title: string | RegExp) {
    return this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.Panels.Panel.headerContainer)
      .filter({ hasText: title })
      .first();
  }

  async selectByTitle(title: string | RegExp | Array<string | RegExp>) {
    if (!Array.isArray(title)) {
      await test.step(`Select panel "${title}"`, async () => {
        await this.getHeaderByTitle(title).click();
      });
    } else {
      await test.step(`Select multiple panels: ${title.join(', ')}`, async () => {
        for (const [index, t] of title.entries()) {
          // first click selects; subsequent shift-clicks extend the multi-selection
          await this.getHeaderByTitle(t).click(index === 0 ? undefined : { modifiers: ['Shift'] });
        }
      });
    }
  }

  async clickMenuItem(panelTitle: string, menuPath: string[]) {
    await test.step(`Click menu item "${menuPath.join(' > ')}" on panel "${panelTitle}"`, async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.Panels.Panel.menu(panelTitle))
        .click({ force: true });

      for (const item of menuPath.slice(0, -1)) {
        await this.dashboardPage.getByGrafanaSelector(this.selectors.components.Panels.Panel.menuItems(item)).hover();
      }

      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.Panels.Panel.menuItems(menuPath.at(-1)!))
        .click();
    });
  }
}
