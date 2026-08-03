import { test, type Locator } from '@playwright/test';

import { PageObject } from './PageObject';

// The dashboard panels in the edit canvas: containers, headers, bodies, selection.
// Plural getters return every match (assert counts, narrow in the spec);
// singular getters return the first match.
// Pass `rows.getContent(...)` or `tabs.getContent(...)` as `scope` to look up
// panels inside a specific row or tab.
export class Panels extends PageObject {
  getContainers(title: string, scope?: Locator): Locator {
    // despite the Panel.title() naming, this data-testid is on the whole
    // panel <section> container, not the title text or header bar.
    // see PanelChrome.tsx and packages/grafana-e2e-selectors/src/selectors/components.ts
    return (scope ?? this.page).getByTestId(this.selectors.components.Panels.Panel.title(title));
  }

  getContainer(title: string, scope?: Locator): Locator {
    return this.getContainers(title, scope).first();
  }

  getHeaders(title?: string | RegExp, scope?: Locator): Locator {
    if (typeof title === 'string') {
      // exact title match via the container testid: a hasText filter would
      // also match longer titles containing this one as a substring
      // (e.g. "Panel repeat 1" would match "Panel repeat 10")
      return this.getContainers(title, scope).getByTestId(this.selectors.components.Panels.Panel.headerContainer);
    }
    const headers = (scope ?? this.page).getByTestId(this.selectors.components.Panels.Panel.headerContainer);
    return title === undefined ? headers : headers.filter({ hasText: title });
  }

  getHeader(title: string | RegExp, scope?: Locator): Locator {
    return this.getHeaders(title, scope).first();
  }

  getBodies() {
    // the rendered panel body below the header
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Panels.Panel.content);
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
