import { test, type Locator } from '@playwright/test';

import { PageObject } from '../PageObject';

/** The "Content outline" pane — tree of dashboard elements (panels, variables, ...) */
export class ContentOutline extends PageObject {
  /** Returns the outline tree */
  getTree(): Locator {
    // lookup scoped to the sidebar container so another role="tree" on the page can't collide
    return this.getByGrafanaSelector(this.selectors.components.Sidebar.container).getByRole('tree');
  }

  /**
   * Returns the outline item showing the given text
   * @param displayedName the text the item shows, e.g. a panel title; a variable shows its label when set, otherwise its name
   */
  getItem(displayedName: string): Locator {
    return this.getByGrafanaSelector(this.selectors.components.PanelEditor.Outline.item(displayedName));
  }

  /**
   * Clicks an outline item to select the corresponding dashboard element
   * @param displayedName the text the item shows, e.g. a panel title; a variable shows its label when set, otherwise its name
   */
  async clickItem(displayedName: string) {
    await test.step(`Click outline item "${displayedName}"`, async () => {
      await this.getItem(displayedName).click();
    });
  }

  /** Toggles the expansion of an outline node (an expandable section header, e.g. "Variables") */
  async toggleNode(itemName: string) {
    await test.step(`Toggle outline node "${itemName}"`, async () => {
      await this.getByGrafanaSelector(this.selectors.components.PanelEditor.Outline.node(itemName)).click();
    });
  }
}
