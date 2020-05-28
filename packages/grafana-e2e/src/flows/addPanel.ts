import { e2e } from '../index';
import { getScenarioContext } from '../support/scenarioContext';

export interface AddPanelConfig {
  dashboardUid?: string;
  dataSourceName: string;
  queriesForm: Function;
  visualizationName: string;
}

const DEFAULT_ADD_PANEL_CONFIG: AddPanelConfig = {
  dataSourceName: 'TestData DB',
  queriesForm: () => {},
  visualizationName: 'Graph',
};

export const addPanel = (config?: Partial<AddPanelConfig>) => {
  const { dashboardUid, dataSourceName, queriesForm, visualizationName } = { ...DEFAULT_ADD_PANEL_CONFIG, ...config };

  getScenarioContext().then(({ lastAddedDashboardUid }: any) => {
    e2e.flows.openDashboard(dashboardUid ?? lastAddedDashboardUid);
    e2e.pages.Dashboard.Toolbar.toolbarItems('Add panel').click();
    e2e.pages.AddDashboard.addNewPanel().click();

    e2e()
      .get('.ds-picker')
      .click()
      .contains('[id^="react-select-"][id*="-option-"]', dataSourceName)
      .click();

    toggleOptionsGroup('type');
    e2e()
      .find(`[aria-label="Plugin visualization item ${visualizationName}"]`)
      .scrollIntoView()
      .click();
    toggleOptionsGroup('type');

    queriesForm();
  });
};

const getOptionsGroup = (name: string) => e2e().get(`.options-group:has([aria-label="Options group Panel ${name}"])`);

const toggleOptionsGroup = (name: string) =>
  getOptionsGroup(name)
    .find('.editor-options-group-toggle')
    .scrollIntoView()
    .click();
