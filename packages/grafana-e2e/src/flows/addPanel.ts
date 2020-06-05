import { e2e } from '../index';
import { getLocalStorage, requireLocalStorage } from '../support/localStorage';
import { getScenarioContext } from '../support/scenarioContext';

export interface AddPanelConfig {
  dashboardUid: string;
  dataSourceName: string;
  queriesForm: (config: AddPanelConfig) => void;
  panelTitle: string;
  visualizationName: string;
  waitForChartData: boolean;
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
      waitForChartData: true,
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
      .scrollIntoView()
      .click();

    isOptionsOpen().then((isOpen: any) => {
      if (!isOpen) {
        toggleOptions();
      }
    });

    openOptionsGroup('settings');
    getOptionsGroup('settings')
      .find('[value="Panel Title"]')
      .scrollIntoView()
      .clear()
      .type(panelTitle);
    closeOptionsGroup('settings');

    openOptionsGroup('type');
    e2e()
      .get(`[aria-label="Plugin visualization item ${visualizationName}"]`)
      .scrollIntoView()
      .click();
    closeOptionsGroup('type');

    e2e().server();
    e2e()
      .route('POST', '/api/ds/query')
      .as('chartData');

    queriesForm(fullConfig);

    e2e().wait('@chartData');

    // @todo enable when plugins have this implemented
    //e2e.components.QueryEditorRow.actionButton('Disable/enable query').click();
    //e2e.components.Panels.Panel.containerByTitle(panelTitle).find('.panel-content').contains('No data');
    //e2e.components.QueryEditorRow.actionButton('Disable/enable query').click();

    isOptionsOpen().then((isOpen: any) => {
      if (isOpen) {
        toggleOptions();
      }
    });

    e2e()
      .get('button[title="Apply changes and go back to dashboard"]')
      .click();

    // @todo remove `wrap` when possible
    return e2e().wrap({ config: fullConfig });
  });

// @todo this actually returns type `Cypress.Chainable`
const closeOptionsGroup = (name: string): any =>
  isOptionsGroupOpen(name).then((isOpen: any) => {
    if (isOpen) {
      toggleOptionsGroup(name);
    }
  });

const getOptionsGroup = (name: string) => e2e().get(`.options-group:has([aria-label="Options group Panel ${name}"])`);

// @todo this actually returns type `Cypress.Chainable`
const isOptionsGroupOpen = (name: string): any =>
  requireLocalStorage(`grafana.dashboard.editor.ui.optionGroup[Panel ${name}]`).then(({ defaultToClosed }: any) => {
    // @todo remove `wrap` when possible
    return e2e().wrap(!defaultToClosed);
  });

// @todo this actually returns type `Cypress.Chainable`
const isOptionsOpen = (): any =>
  getLocalStorage('grafana.dashboard.editor.ui').then((data: any) => {
    if (data) {
      // @todo remove `wrap` when possible
      return e2e().wrap(data.isPanelOptionsVisible);
    } else {
      // @todo remove `wrap` when possible
      return e2e().wrap(true);
    }
  });

// @todo this actually returns type `Cypress.Chainable`
const openOptionsGroup = (name: string): any =>
  isOptionsGroupOpen(name).then((isOpen: any) => {
    if (!isOpen) {
      toggleOptionsGroup(name);
    }
  });

const toggleOptions = () => e2e.components.PanelEditor.OptionsPane.close().click();

const toggleOptionsGroup = (name: string) =>
  getOptionsGroup(name)
    .find('.editor-options-group-toggle')
    .click();
