import { PageObject } from '../PageObject';

export class DashboardOptions extends PageObject {
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
