import { type Locator, test } from '@playwright/test';

import { PageObject } from './PageObject';

export class Canvas extends PageObject {
  async addPanel(panelsContainer?: Locator) {
    await test.step('Add panel from canvas', async () => {
      // Like groupPanels: each nested grid (per row/tab) renders its own "Add panel"
      // button — scope the click to the given container to target the right one.
      const container =
        panelsContainer ??
        this.dashboardPage.getByGrafanaSelector(this.selectors.components.DashboardEditPaneSplitter.primaryBody);

      // The edit canvas scrolls via the first child of primaryBody — neither
      // primaryBody nor a row/tab content wrapper is scrollable, so scrolling
      // `container` would be a silent no-op. Scroll to the bottom so
      // lazy-loaded panels render before the "Add panel" button is clicked.
      const scrollContainer = this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.DashboardEditPaneSplitter.primaryBody)
        .locator('> div')
        .first();
      await scrollContainer.evaluate((el) => el.scrollTo(0, el.scrollHeight));

      await container.getByTestId(this.selectors.components.CanvasGridAddActions.addPanel).click();
    });
  }

  // No scoping parameter yet because no migrated spec needs one yet
  async addTab() {
    await test.step('Add tab from canvas', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.CanvasGridAddActions.addTab).click();
    });
  }

  // No scoping parameter yet because no migrated spec needs one yet
  async addRow() {
    await test.step('Add row from canvas', async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.CanvasGridAddActions.addRow).click();
    });
  }

  async groupPanels(targetLayout: 'row' | 'tab', panelsContainer?: Locator) {
    await test.step(`Group panels into ${targetLayout}`, async () => {
      // The add actions are revealed by hovering the layout container that hosts them
      // (opacity 0 otherwise). Pass `panelsContainer` when grouping inside a nested
      // layout (tab/row); by default the whole edit canvas body is hovered.
      const container =
        panelsContainer ??
        this.dashboardPage.getByGrafanaSelector(this.selectors.components.DashboardEditPaneSplitter.primaryBody);

      // Hover the top-left pixel instead of the default center, which could land on
      // a panel and trigger unrelated hover states (header actions, tooltips)
      await container.hover({ position: { x: 0, y: 0 } });

      // Each nested grid (per row/tab) renders its own add actions strip, so a
      // page-level lookup can match several "Group panels" buttons — scope the
      // click to the hovered container to target the one that was just revealed.
      await container.getByTestId(this.selectors.components.CanvasGridAddActions.groupPanels).click();

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
}
