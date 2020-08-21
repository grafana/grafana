import { e2e } from '../index';
import { getLocalStorage, requireLocalStorage } from '../support/localStorage';
import { getScenarioContext } from '../support/scenarioContext';
import { selectOption } from './selectOption';

export interface ConfigurePanelConfig {
  chartData: {
    method: string;
    route: string | RegExp;
  };
  dashboardUid: string;
  dataSourceName?: string;
  matchScreenshot: boolean;
  queriesForm?: (config: any) => void;
  panelTitle: string;
  screenshotName: string;
  visitDashboardAtStart: boolean; // @todo remove when possible
  visualizationName?: string;
}

// @todo improve config input/output: https://stackoverflow.com/a/63507459/923745
// @todo this actually returns type `Cypress.Chainable`
export const configurePanel = (config: Partial<ConfigurePanelConfig>, edit: boolean): any =>
  getScenarioContext().then(({ lastAddedDashboardUid }: any) => {
    const fullConfig = {
      chartData: {
        method: 'POST',
        route: '/api/ds/query',
      },
      dashboardUid: lastAddedDashboardUid,
      matchScreenshot: false,
      saveDashboard: true,
      screenshotName: 'chart',
      visitDashboardAtStart: true,
      ...config,
    } as ConfigurePanelConfig;

    const {
      chartData,
      dashboardUid,
      dataSourceName,
      matchScreenshot,
      panelTitle,
      queriesForm,
      screenshotName,
      visitDashboardAtStart,
      visualizationName,
    } = fullConfig;

    if (visitDashboardAtStart) {
      e2e.flows.openDashboard({ uid: dashboardUid });
    }

    if (edit) {
      e2e.components.Panels.Panel.title(panelTitle).click();
      e2e.components.Panels.Panel.headerItems('Edit').click();
    } else {
      e2e.pages.Dashboard.Toolbar.toolbarItems('Add panel').click();
      e2e.pages.AddDashboard.addNewPanel().click();
    }

    e2e().server();

    // @todo alias '/**/*.js*' as '@pluginModule' when possible: https://github.com/cypress-io/cypress/issues/1296

    e2e()
      .route(chartData.method, chartData.route)
      .as('chartData');

    if (dataSourceName) {
      selectOption(e2e.components.DataSourcePicker.container(), dataSourceName);
    }

    // @todo instead wait for '@pluginModule'
    e2e().wait(2000);

    e2e().wait('@chartData');

    // `panelTitle` is needed to edit the panel, and unlikely to have its value changed at that point
    const changeTitle = panelTitle && !edit;

    if (changeTitle || visualizationName) {
      openOptions();

      if (changeTitle) {
        openOptionsGroup('settings');
        getOptionsGroup('settings')
          .find('[value="Panel Title"]')
          .scrollIntoView()
          .clear()
          .type(panelTitle);
        closeOptionsGroup('settings');
      }

      if (visualizationName) {
        openOptionsGroup('type');
        e2e.components.PluginVisualization.item(visualizationName)
          .scrollIntoView()
          .click();
        closeOptionsGroup('type');
      }

      closeOptions();
    } else {
      // Options are consistently closed
      closeOptions();
    }

    if (queriesForm) {
      queriesForm(fullConfig);
      e2e().wait('@chartData');
    }

    // @todo enable when plugins have this implemented
    //e2e.components.QueryEditorRow.actionButton('Disable/enable query').click();
    //e2e().wait('@chartData');
    //e2e.components.Panels.Panel.containerByTitle(panelTitle).find('.panel-content').contains('No data');
    //e2e.components.QueryEditorRow.actionButton('Disable/enable query').click();
    //e2e().wait('@chartData');

    e2e()
      .get('button[title="Apply changes and go back to dashboard"]')
      .click();

    e2e()
      .url()
      .should('include', `/d/${dashboardUid}`);

    e2e().wait('@chartData');

    // Wait for RxJS
    e2e().wait(500);

    if (matchScreenshot) {
      e2e.components.Panels.Panel.containerByTitle(panelTitle)
        .find('.panel-content')
        .screenshot(screenshotName);
      e2e().compareScreenshots(screenshotName);
    }

    // @todo remove `wrap` when possible
    return e2e().wrap({ config: fullConfig }, { log: false });
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
    return e2e().wrap(!defaultToClosed, { log: false });
  });

// @todo this actually returns type `Cypress.Chainable`
const isOptionsOpen = (): any =>
  getLocalStorage('grafana.dashboard.editor.ui').then((data: any) => {
    if (data) {
      // @todo remove `wrap` when possible
      return e2e().wrap(data.isPanelOptionsVisible, { log: false });
    } else {
      // @todo remove `wrap` when possible
      return e2e().wrap(true, { log: false });
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
