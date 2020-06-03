import { e2e } from '../index';
import { getScenarioContext } from '../support/scenarioContext';

export interface AddPanelConfig {
  dashboardUid: string;
  dataSourceName: string;
  queriesForm: (config: AddPanelConfig) => void;
  panelTitle: string;
  visualizationName: string;
}

// @todo this actually returns type `Cypress.Chainable`
export const addPanel = (config?: Partial<AddPanelConfig>): any =>
  getScenarioContext().then(({ lastAddedDashboardUid, lastAddedDataSource }: any) => {
    const fullConfig = {
      dashboardUid: lastAddedDashboardUid,
      dataSourceName: lastAddedDataSource,
      panelTitle: `e2e-${Date.now()}`,
      queriesForm: () => {},
      visualizationName: 'Table',
      ...config,
    } as AddPanelConfig;

    const { dashboardUid, dataSourceName, panelTitle, queriesForm, visualizationName } = fullConfig;

    e2e.flows.openDashboard(dashboardUid);
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

    queriesForm(fullConfig);

    // @todo enable when plugins have this implemented
    //e2e.components.QueryEditorRow.actionButton('Disable/enable query').click();
    //e2e.components.Panels.Panel.containerByTitle(panelTitle).find('.panel-content').contains('No data');
    //e2e.components.QueryEditorRow.actionButton('Disable/enable query').click();

    e2e.components.PanelEditor.OptionsPane.close().click();

    e2e()
      .get('button[title="Apply changes and go back to dashboard"]')
      .click();

    // @todo remove `wrap` when possible
    return e2e().wrap({ config: fullConfig });
  });

const getOptionsGroup = (name: string) => e2e().get(`.options-group:has([aria-label="Options group Panel ${name}"])`);

const toggleOptionsGroup = (name: string) =>
  getOptionsGroup(name)
    .find('.editor-options-group-toggle')
    .scrollIntoView()
    .click();
