import { test, type Locator } from '@playwright/test';

import { PageObject } from './PageObject';

/**
 * The dashboard panels in the edit canvas: whole panels, headers, bodies, selection.
 * Plural getters return every match (assert counts, narrow in the spec);
 * singular getters return the first match.
 * Pass `rows.getContent(...)` or `tabs.getContent(...)` as `scope` to look up
 * panels inside a specific row or tab.
 */
export class Panels extends PageObject {
  /**
   * Returns all matching panel `<section>` containers (exact title match)
   * @param scope container to search within, defaults to the whole page
   */
  getPanels(panelTitle: string, scope?: Locator): Locator {
    // despite the Panel.title() naming, this data-testid is on the whole
    // panel <section> container, not the title text or header bar.
    // see PanelChrome.tsx and packages/grafana-e2e-selectors/src/selectors/components.ts
    return (scope ?? this.page).getByTestId(this.selectors.components.Panels.Panel.title(panelTitle));
  }

  /**
   * Returns the first matching panel `<section>` container
   * @param scope container to search within, defaults to the whole page
   */
  getPanel(panelTitle: string, scope?: Locator): Locator {
    return this.getPanels(panelTitle, scope).first();
  }

  /**
   * Returns panel header bars: a string matches the title exactly, a RegExp filters
   * headers by text, no argument returns all headers
   * @param scope container to search within, defaults to the whole page
   */
  getHeaders(panelTitle?: string | RegExp, scope?: Locator): Locator {
    if (typeof panelTitle === 'string') {
      // exact title match via the panel testid: a hasText filter would
      // also match longer titles containing this one as a substring
      // (e.g. "Panel repeat 1" would match "Panel repeat 10")
      return this.getPanels(panelTitle, scope).getByTestId(this.selectors.components.Panels.Panel.headerContainer);
    }
    const headers = (scope ?? this.page).getByTestId(this.selectors.components.Panels.Panel.headerContainer);
    return panelTitle === undefined ? headers : headers.filter({ hasText: panelTitle });
  }

  /**
   * Returns the first matching panel header bar
   * @param scope container to search within, defaults to the whole page
   */
  getHeader(panelTitle: string | RegExp, scope?: Locator): Locator {
    return this.getHeaders(panelTitle, scope).first();
  }

  /** Returns all rendered panel bodies below the header */
  getBodies() {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Panels.Panel.content);
  }

  /**
   * Selects a panel by clicking its header; an array extends the selection via shift-clicks
   * @param panelTitle a string or RegExp to select one panel, an array of them to multi-select
   */
  async selectByTitle(panelTitle: string | RegExp | Array<string | RegExp>) {
    if (!Array.isArray(panelTitle)) {
      await test.step(`Select panel "${panelTitle}"`, async () => {
        await this.getHeader(panelTitle).click();
      });
    } else {
      await test.step(`Select multiple panels: ${panelTitle.join(', ')}`, async () => {
        for (const [index, t] of panelTitle.entries()) {
          // first click selects; subsequent shift-clicks extend the multi-selection
          await this.getHeader(t).click(index === 0 ? undefined : { modifiers: ['Shift'] });
        }
      });
    }
  }

  /** Selects the panel at the given index by clicking its header */
  async selectByIndex(panelIndex: number) {
    await test.step(`Select panel at index ${panelIndex}`, async () => {
      await this.getHeaders().nth(panelIndex).click();
    });
  }

  /**
   * Opens the panel menu and clicks through to the given menu item
   * @param menuPath each segment is the item's label, e.g. ['More...', 'Duplicate']
   */
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
