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

// @todo this actually returns type `Cypress.Chainable`
export const addPanel = (config?: Partial<AddPanelConfig>): any => {
  const { dashboardUid, dataSourceName, queriesForm, visualizationName } = { ...DEFAULT_ADD_PANEL_CONFIG, ...config };
  const panelTitle = `e2e-${Date.now()}`;

  return getScenarioContext()
    .then(({ lastAddedDashboardUid }: any) => {
      e2e.flows.openDashboard(dashboardUid ?? lastAddedDashboardUid);
      e2e.pages.Dashboard.Toolbar.toolbarItems('Add panel').click();
      e2e.pages.AddDashboard.addNewPanel().click();

      e2e()
        .get('.ds-picker')
        .click()
        .contains('[id^="react-select-"][id*="-option-"]', dataSourceName)
        .click();

      getOptionsGroup('settings')
        .find('[value="Panel Title"]')
        .clear()
        .type(panelTitle);
      toggleOptionsGroup('settings');

      toggleOptionsGroup('type');
      e2e()
        .get(`[aria-label="Plugin visualization item ${visualizationName}"]`)
        .scrollIntoView()
        .click();
      toggleOptionsGroup('type');

      queriesForm();
    })
    .then(() => panelTitle);
};

const getOptionsGroup = (name: string) => e2e().get(`.options-group:has([aria-label="Options group Panel ${name}"])`);

const toggleOptionsGroup = (name: string) =>
  getOptionsGroup(name)
    .find('.editor-options-group-toggle')
    .scrollIntoView()
    .click();
