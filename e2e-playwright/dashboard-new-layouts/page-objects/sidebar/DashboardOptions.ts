import { type Locator } from '@playwright/test';

import { PageObject, type PageObjectArgs } from '../PageObject';

import { GridLayoutOptions } from './shared/GridLayoutOptions';

/**
 * The "Dashboard options" pane in the sidebar — title/description inputs,
 * plus the shared layout switcher (auto/custom grid, rows, tabs)
 */
export class DashboardOptions extends PageObject {
  readonly gridLayoutOptions: GridLayoutOptions;

  constructor(args: PageObjectArgs) {
    super(args);
    this.gridLayoutOptions = new GridLayoutOptions(args);
  }

  /** Returns the dashboard title input */
  getTitleInput(): Locator {
    return this.getByGrafanaSelector(
      this.selectors.components.PanelEditor.OptionsPane.fieldLabel('dashboard-options Title')
    ).locator('input');
  }

  /** Returns the dashboard description textarea */
  getDescriptionTextarea(): Locator {
    return this.getByGrafanaSelector(
      this.selectors.components.PanelEditor.OptionsPane.fieldLabel('dashboard-options Description')
    ).locator('textarea');
  }
}
