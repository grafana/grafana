import { test } from '@playwright/test';

import { PageObject } from './PageObject';

// The dashboard panels in the edit canvas: containers, headers, and selection.
// Plural getters return every match (assert counts, narrow in the spec);
// singular getters return the first match.
export class Panels extends PageObject {
  getContainers(title: string) {
    // despite the Panel.title() naming, this data-testid is on the whole
    // panel <section> container, not the title text or header bar.
    // see PanelChrome.tsx and packages/grafana-e2e-selectors/src/selectors/components.ts
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Panels.Panel.title(title));
  }

  getContainer(title: string) {
    return this.getContainers(title).first();
  }

  getHeaders(title?: string | RegExp) {
    const headers = this.dashboardPage.getByGrafanaSelector(this.selectors.components.Panels.Panel.headerContainer);
    return title === undefined ? headers : headers.filter({ hasText: title });
  }

  getHeader(title: string | RegExp) {
    return this.getHeaders(title).first();
  }

  async selectByTitle(title: string | RegExp | Array<string | RegExp>) {
    if (!Array.isArray(title)) {
      await test.step(`Select panel "${title}"`, async () => {
        await this.getHeader(title).click();
      });
    } else {
      await test.step(`Select multiple panels: ${title.join(', ')}`, async () => {
        for (const [index, t] of title.entries()) {
          // first click selects; subsequent shift-clicks extend the multi-selection
          await this.getHeader(t).click(index === 0 ? undefined : { modifiers: ['Shift'] });
        }
      });
    }
  }

  async selectByIndex(index: number) {
    await test.step(`Select panel at index ${index}`, async () => {
      await this.getHeaders().nth(index).click();
    });
  }

  async selectMenuItem(panelTitle: string, menuPath: string[]) {
    await test.step(`Select menu item "${menuPath.join(' > ')}" on panel "${panelTitle}"`, async () => {
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
