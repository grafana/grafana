import { e2e } from '../index';
import { getLocalStorage, requireLocalStorage } from '../support/localStorage';
import { getScenarioContext } from '../support/scenarioContext';
import { selectOption } from './selectOption';

export interface AddPanelConfig {
  chartData: {
    method: string;
    route: string | RegExp;
  };
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
      chartData: {
        method: 'POST',
        route: '/api/ds/query',
      },
      dashboardUid: lastAddedDashboardUid,
      dataSourceName: lastAddedDataSource,
      panelTitle: `e2e-${Date.now()}`,
      queriesForm: () => {},
      visualizationName: 'Table',
      waitForChartData: true,
      ...config,
    } as AddPanelConfig;

    const { chartData, dashboardUid, dataSourceName, panelTitle, queriesForm, visualizationName } = fullConfig;

    e2e.flows.openDashboard({ uid: dashboardUid });
    e2e.pages.Dashboard.Toolbar.toolbarItems('Add panel').click();
    e2e.pages.AddDashboard.addNewPanel().click();

    e2e().server();

    // @todo alias '/**/*.js*' as '@pluginModule' when possible: https://github.com/cypress-io/cypress/issues/1296

    e2e()
      .route(chartData.method, chartData.route)
      .as('chartData');

    selectOption(e2e.components.DataSourcePicker.container(), dataSourceName);

    // @todo instead wait for '@pluginModule'
    e2e().wait(2000);

    openOptions();

    openOptionsGroup('settings');
    getOptionsGroup('settings')
      .find('[value="Panel Title"]')
      .scrollIntoView()
      .clear()
      .type(panelTitle);
    closeOptionsGroup('settings');

    openOptionsGroup('type');
    e2e.components.PluginVisualization.item(visualizationName)
      .scrollIntoView()
      .click();
    closeOptionsGroup('type');

    closeOptions();

    queriesForm(fullConfig);

    e2e().wait('@chartData');

    // @todo enable when plugins have this implemented
    //e2e.components.QueryEditorRow.actionButton('Disable/enable query').click();
    //e2e.components.Panels.Panel.containerByTitle(panelTitle).find('.panel-content').contains('No data');
    //e2e.components.QueryEditorRow.actionButton('Disable/enable query').click();

    e2e()
      .get('button[title="Apply changes and go back to dashboard"]')
      .click();

    e2e().wait('@chartData');

    // Wait for RxJS
    e2e().wait(500);

    // @todo remove `wrap` when possible
    return e2e().wrap({ config: fullConfig });
  });

// @todo this actually returns type `Cypress.Chainable`
const closeOptions = (): any =>
  isOptionsOpen().then((isOpen: any) => {
    if (isOpen) {
      e2e.components.PanelEditor.OptionsPane.close().click();
    }
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
const openOptions = (): any =>
  isOptionsOpen().then((isOpen: any) => {
    if (!isOpen) {
      e2e.components.PanelEditor.OptionsPane.open().click();
    }
  });

// @todo this actually returns type `Cypress.Chainable`
const openOptionsGroup = (name: string): any =>
  isOptionsGroupOpen(name).then((isOpen: any) => {
    if (!isOpen) {
      toggleOptionsGroup(name);
    }
  });

const toggleOptionsGroup = (name: string) =>
  getOptionsGroup(name)
    .find('.editor-options-group-toggle')
    .click();
