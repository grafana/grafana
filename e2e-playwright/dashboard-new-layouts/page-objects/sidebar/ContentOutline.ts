import { test, type Locator } from '@playwright/test';

import { PageObject } from '../PageObject';

// The "Content outline" pane — tree of dashboard elements (panels, variables, ...)
export class ContentOutline extends PageObject {
  // Scoped to the sidebar container so another role="tree" on the page can't collide
  getTree(): Locator {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.container).getByRole('tree');
  }

  async clickItem(name: string) {
    await test.step(`Click outline item "${name}"`, async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.PanelEditor.Outline.item(name)).click();
    });
  }

  // Nodes are the expandable section headers (e.g. "Variables"); clicking toggles expansion
  async toggleNode(name: string) {
    await test.step(`Toggle outline node "${name}"`, async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.PanelEditor.Outline.node(name)).click();
    });
  }
}
