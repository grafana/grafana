import { e2e } from '../index';
import { getScenarioContext } from '../support/scenarioContext';

export interface AddPanelConfig {
  dataSourceName: string;
  queriesForm: Function;
}

const DEFAULT_ADD_PANEL_CONFIG: AddPanelConfig = {
  dataSourceName: 'TestData DB',
  queriesForm: () => {},
};

export const addPanel = (config?: Partial<AddPanelConfig>) => {
  const { dataSourceName, queriesForm } = { ...DEFAULT_ADD_PANEL_CONFIG, ...config };

  // @todo remove `@ts-ignore` when possible
  // @ts-ignore
  getScenarioContext().then(({ lastAddedDashboardUid }) => {
    e2e.flows.openDashboard(lastAddedDashboardUid);
    e2e.pages.Dashboard.Toolbar.toolbarItems('Add panel').click();
    e2e.pages.AddDashboard.ctaButtons('Add Query').click();
    e2e()
      .get('.ds-picker')
      .click()
      .contains(dataSourceName)
      .click();
    queriesForm();
  });
};
