import { type Locator, test } from '@playwright/test';

import { PageObject } from './PageObject';

/**
 * The dashboard edit canvas (the area left of the sidebar) — hosts the grid
 * add actions: add panel/tab/row, paste tab/row, group panels into a row
 * or tab, and ungroup them
 */
export class Canvas extends PageObject {
  /** Returns the edit canvas body (the area left of the sidebar) */
  getContainer() {
    return this.getByGrafanaSelector(this.selectors.components.DashboardSidebarSplitter.primaryBody);
  }

  /**
   * Returns the "Add panel" button
   * @param panelsContainer grid container the lookup is scoped to (e.g. `rows.getContent(...)`), defaults to the whole edit canvas
   */
  getAddPanelButton(panelsContainer?: Locator): Locator {
    return (panelsContainer ?? this.getContainer()).getByTestId(
      this.selectors.components.CanvasGridAddActions.addPanel
    );
  }

  /**
   * Adds a panel by clicking the "Add panel" button, scrolling to the bottom of the canvas first
   * @param panelsContainer grid container the lookup is scoped to (e.g. `rows.getContent(...)`), defaults to the whole edit canvas
   */
  async addPanel(panelsContainer?: Locator) {
    await test.step('Add panel from canvas', async () => {
      // The edit canvas scrolls via the first child of primaryBody — neither
      // primaryBody nor a row/tab content wrapper is scrollable, so scrolling
      // `container` would be a silent no-op. Scroll to the bottom so
      // lazy-loaded panels render before the "Add panel" button is clicked.
      const scrollContainer = this.getContainer().locator('> div').first();
      await scrollContainer.evaluate((el) => el.scrollTo(0, el.scrollHeight));

      await this.getAddPanelButton(panelsContainer).click();
    });
  }

  /**
   * Returns the "Group panels" button
   * @param panelsContainer grid container the lookup is scoped to (e.g. `rows.getContent(...)`), defaults to the whole edit canvas
   */
  getGroupPanelsButton(panelsContainer?: Locator): Locator {
    return (panelsContainer ?? this.getContainer()).getByTestId(
      this.selectors.components.CanvasGridAddActions.groupPanels
    );
  }

  /**
   * Groups the grid's panels into a row or tab via the "Group panels" menu
   * @param panelsContainer grid container the lookup is scoped to (e.g. `rows.getContent(...)`), defaults to the whole edit canvas
   */
  async groupPanels(targetLayout: 'row' | 'tab', panelsContainer?: Locator) {
    await test.step(`Group panels into ${targetLayout}`, async () => {
      // The add actions are revealed by hovering the layout container that hosts them
      // (opacity 0 otherwise). Pass `panelsContainer` when grouping inside a nested
      // layout (tab/row); by default the whole edit canvas body is hovered.
      const container = panelsContainer ?? this.getContainer();

      // Hover the top-left pixel instead of the default center, which could land on
      // a panel and trigger unrelated hover states (header actions, tooltips)
      await container.hover({ position: { x: 0, y: 0 } });

      await this.getGroupPanelsButton(panelsContainer).click();

      await this.page
        .getByRole('menu')
        .getByTestId(
          targetLayout === 'row'
            ? this.selectors.components.CanvasGridAddActions.addRow
            : this.selectors.components.CanvasGridAddActions.addTab
        )
        .click();
    });
  }

  /**
   * Returns the "Add tab" button
   * @param panelsContainer grid container the lookup is scoped to (e.g. `rows.getContent(...)`), defaults to the whole edit canvas
   */
  getAddTabButton(panelsContainer?: Locator): Locator {
    return (panelsContainer ?? this.getContainer()).getByTestId(this.selectors.components.CanvasGridAddActions.addTab);
  }

  /**
   * Adds a tab by clicking the "Add tab" button
   * @param panelsContainer grid container the lookup is scoped to (e.g. `rows.getContent(...)`), defaults to the whole edit canvas
   */
  async addTab(panelsContainer?: Locator) {
    await test.step('Add tab from canvas', async () => {
      await this.getAddTabButton(panelsContainer).click();
    });
  }

  /**
   * Pastes a copied tab via the "Paste tab" add action
   * @param panelsContainer grid container the lookup is scoped to (e.g. `rows.getContent(...)`), defaults to the whole edit canvas
   */
  async pasteTab(panelsContainer?: Locator) {
    await test.step('Paste tab from canvas', async () => {
      await (panelsContainer ?? this.getContainer())
        .getByTestId(this.selectors.components.CanvasGridAddActions.pasteTab)
        .click();
    });
  }

  /**
   * Ungroups a tabs layout via the "Ungroup" add action
   * @param panelsContainer grid container the lookup is scoped to (e.g. `rows.getContent(...)`), defaults to the whole edit canvas
   */
  async ungroupTabs(panelsContainer?: Locator) {
    await test.step('Ungroup tabs', async () => {
      await (panelsContainer ?? this.getContainer())
        .getByTestId(this.selectors.components.CanvasGridAddActions.ungroup)
        .click();
    });
  }

  /**
   * Returns the "Add row" button
   * @param panelsContainer grid container the lookup is scoped to (e.g. `rows.getContent(...)`), defaults to the whole edit canvas
   */
  getAddRowButton(panelsContainer?: Locator): Locator {
    return (panelsContainer ?? this.getContainer()).getByTestId(this.selectors.components.CanvasGridAddActions.addRow);
  }

  /**
   * Adds a row by clicking the "Add row" button
   * @param panelsContainer grid container the lookup is scoped to (e.g. `rows.getContent(...)`), defaults to the whole edit canvas
   */
  async addRow(panelsContainer?: Locator) {
    await test.step('Add row from canvas', async () => {
      await this.getAddRowButton(panelsContainer).click();
    });
  }

  /**
   * Pastes a copied row via the "Paste row" add action
   * @param panelsContainer grid container the lookup is scoped to (e.g. `rows.getContent(...)`), defaults to the whole edit canvas
   */
  async pasteRow(panelsContainer?: Locator) {
    await test.step('Paste row from canvas', async () => {
      await (panelsContainer ?? this.getContainer())
        .getByTestId(this.selectors.components.CanvasGridAddActions.pasteRow)
        .click();
    });
  }

  /**
   * Ungroups a rows layout via the "Ungroup rows" add action
   * @param panelsContainer grid container the lookup is scoped to (e.g. `rows.getContent(...)`), defaults to the whole edit canvas
   */
  async ungroupRows(panelsContainer?: Locator) {
    await test.step('Ungroup rows', async () => {
      await (panelsContainer ?? this.getContainer())
        .getByTestId(this.selectors.components.CanvasGridAddActions.ungroupRows)
        .click();
    });
  }
}
