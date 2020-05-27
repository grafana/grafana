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

  getScenarioContext().then(({ lastAddedDashboardUid }: any) => {
    e2e.flows.openDashboard(lastAddedDashboardUid);
    e2e.pages.Dashboard.Toolbar.toolbarItems('Add panel').click();
    e2e.pages.AddDashboard.addNewPanel().click();
    e2e()
      .get('.ds-picker')
      .click()
      .contains('[id^="react-select-"][id*="-option-"]', dataSourceName)
      .click();
    queriesForm();
  });
};
