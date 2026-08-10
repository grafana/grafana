import { type Locator, test } from '@playwright/test';

import { PageObject } from './PageObject';

// The dashboard edit canvas (the area left of the sidebar) — hosts the grid
// add actions: add panel/tab/row and group panels into a row or tab
export class Canvas extends PageObject {
  getContainer() {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.DashboardSidebarSplitter.primaryBody);
  }

  // Each nested grid (per row/tab) renders its own "Add panel" button —
  // pass the grid's container (e.g. rows.getContent(...)) to target a specific one
  getAddPanelButton(panelsContainer?: Locator): Locator {
    return (panelsContainer ?? this.getContainer()).getByTestId(
      this.selectors.components.CanvasGridAddActions.addPanel
    );
  }

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

  // Each nested grid (per row/tab) renders its own add actions strip, so a
  // page-level lookup can match several "Group panels" buttons — pass the grid's
  // container (e.g. rows.getContent(...)) to target a specific one
  getGroupPanelsButton(panelsContainer?: Locator): Locator {
    return (panelsContainer ?? this.getContainer()).getByTestId(
      this.selectors.components.CanvasGridAddActions.groupPanels
    );
  }

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

  // Scoped to the canvas container: the "Group into tab" menu item reuses the
  // same testid in a portalled menu, which a page-wide lookup could match
  getAddTabButton(panelsContainer?: Locator): Locator {
    return (panelsContainer ?? this.getContainer()).getByTestId(this.selectors.components.CanvasGridAddActions.addTab);
  }

  async addTab(panelsContainer?: Locator) {
    await test.step('Add tab from canvas', async () => {
      await this.getAddTabButton(panelsContainer).click();
    });
  }

  async pasteTab(panelsContainer?: Locator) {
    await test.step('Paste tab from canvas', async () => {
      await (panelsContainer ?? this.getContainer())
        .getByTestId(this.selectors.components.CanvasGridAddActions.pasteTab)
        .click();
    });
  }

  // The "ungroup" testid is only rendered for tabs layouts (rows have their own
  // "ungroupRows" testid), hence the more explicit method name
  async ungroupTabs(panelsContainer?: Locator) {
    await test.step('Ungroup tabs', async () => {
      await (panelsContainer ?? this.getContainer())
        .getByTestId(this.selectors.components.CanvasGridAddActions.ungroup)
        .click();
    });
  }

  // Scoped to the canvas container: the "Group into row" menu item reuses the
  // same testid in a portalled menu, which a page-wide lookup could match
  getAddRowButton(panelsContainer?: Locator): Locator {
    return (panelsContainer ?? this.getContainer()).getByTestId(this.selectors.components.CanvasGridAddActions.addRow);
  }

  async addRow(panelsContainer?: Locator) {
    await test.step('Add row from canvas', async () => {
      await this.getAddRowButton(panelsContainer).click();
    });
  }

  async pasteRow(panelsContainer?: Locator) {
    await test.step('Paste row from canvas', async () => {
      await (panelsContainer ?? this.getContainer())
        .getByTestId(this.selectors.components.CanvasGridAddActions.pasteRow)
        .click();
    });
  }

  async ungroupRows(panelsContainer?: Locator) {
    await test.step('Ungroup rows', async () => {
      await (panelsContainer ?? this.getContainer())
        .getByTestId(this.selectors.components.CanvasGridAddActions.ungroupRows)
        .click();
    });
  }
}
