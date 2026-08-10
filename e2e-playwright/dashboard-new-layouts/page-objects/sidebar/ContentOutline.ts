import { test, type Locator } from '@playwright/test';

import { PageObject } from '../PageObject';

/** The "Content outline" pane — tree of dashboard elements (panels, variables, ...) */
export class ContentOutline extends PageObject {
  /** Returns the outline tree */
  getTree(): Locator {
    // lookup scoped to the sidebar container so another role="tree" on the page can't collide
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.container).getByRole('tree');
  }

  /** Clicks an outline item to select the corresponding dashboard element */
  async clickItem(itemName: string) {
    await test.step(`Click outline item "${itemName}"`, async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.PanelEditor.Outline.item(itemName))
        .click();
    });
  }

  /** Toggles the expansion of an outline node (an expandable section header, e.g. "Variables") */
  async toggleNode(itemName: string) {
    await test.step(`Toggle outline node "${itemName}"`, async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.PanelEditor.Outline.node(itemName))
        .click();
    });
  }
}
