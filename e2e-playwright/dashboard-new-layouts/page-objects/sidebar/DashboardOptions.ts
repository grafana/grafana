import { PageObject, type PageObjectArgs } from '../PageObject';

import { GridLayoutOptions } from './shared/GridLayoutOptions';

// The "Dashboard options" pane in the sidebar — title/description inputs,
// plus the shared grid layout switcher (auto/custom grid)
export class DashboardOptions extends PageObject {
  public gridLayoutOptions: GridLayoutOptions;

  constructor(args: PageObjectArgs) {
    super(args);
    this.gridLayoutOptions = new GridLayoutOptions(args);
  }

  getTitleInput() {
    return this.dashboardPage
      .getByGrafanaSelector(this.selectors.components.PanelEditor.OptionsPane.fieldLabel('dashboard-options Title'))
      .locator('input');
  }

  getDescriptionTextarea() {
    return this.dashboardPage
      .getByGrafanaSelector(
        this.selectors.components.PanelEditor.OptionsPane.fieldLabel('dashboard-options Description')
      )
      .locator('textarea');
  }
}
