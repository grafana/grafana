import { PageObject } from '../PageObject';

// The "Content outline" pane — tree of dashboard elements (panels, variables, ...)
export class ContentOutline extends PageObject {
  getItem(name: string) {
    return this.dashboardPage.getByGrafanaSelector(this.selectors.components.PanelEditor.Outline.item(name));
  }
}
