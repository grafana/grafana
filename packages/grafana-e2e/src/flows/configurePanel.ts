import { e2e } from '../index';
import { getLocalStorage, requireLocalStorage } from '../support/localStorage';
import { getScenarioContext } from '../support/scenarioContext';
import { selectOption } from './selectOption';
import { setDashboardTimeRange } from './setDashboardTimeRange';
import { setTimeRange, TimeRangeConfig } from './setTimeRange';

export interface ConfigurePanelConfig {
  chartData: {
    method: string;
    route: string | RegExp;
  };
  dashboardUid: string;
  dataSourceName?: string;
  isExplore: boolean;
  matchScreenshot: boolean;
  queriesForm?: (config: any) => void;
  panelTitle: string;
  screenshotName: string;
  timeRange?: TimeRangeConfig;
  visitDashboardAtStart: boolean; // @todo remove when possible
  visualizationName?: string;
}

// @todo improve config input/output: https://stackoverflow.com/a/63507459/923745
// @todo this actually returns type `Cypress.Chainable`
export const configurePanel = (config: Partial<ConfigurePanelConfig>, isEdit: boolean): any =>
  getScenarioContext().then(({ lastAddedDashboardUid }: any) => {
    const fullConfig = {
      chartData: {
        method: 'POST',
        route: '/api/ds/query',
      },
      dashboardUid: lastAddedDashboardUid,
      isExplore: false,
      matchScreenshot: false,
      saveDashboard: true,
      screenshotName: 'panel-visualization',
      visitDashboardAtStart: true,
      ...config,
    } as ConfigurePanelConfig;

    const {
      chartData,
      dashboardUid,
      dataSourceName,
      isExplore,
      matchScreenshot,
      panelTitle,
      queriesForm,
      screenshotName,
      timeRange,
      visitDashboardAtStart,
      visualizationName,
    } = fullConfig;

    if (isExplore) {
      e2e.pages.Explore.visit();
    } else {
      if (visitDashboardAtStart) {
        e2e.flows.openDashboard({ uid: dashboardUid });
      }

      if (isEdit) {
        e2e.components.Panels.Panel.title(panelTitle).click();
        e2e.components.Panels.Panel.headerItems('Edit').click();
      } else {
        e2e.pages.Dashboard.Toolbar.toolbarItems('Add panel').click();
        e2e.pages.AddDashboard.addNewPanel().click();
      }
    }

    if (timeRange) {
      if (isExplore) {
        e2e.pages.Explore.Toolbar.navBar().within(() => setTimeRange(timeRange));
      } else {
        setDashboardTimeRange(timeRange);
      }
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

    if (!isExplore) {
      // `panelTitle` is needed to edit the panel, and unlikely to have its value changed at that point
      const changeTitle = panelTitle && !isEdit;

      if (changeTitle || visualizationName) {
        openOptions();

        if (changeTitle) {
          openOptionsGroup('settings');
          getOptionsGroup('settings')
            .find('[value="Panel Title"]')
            .scrollIntoView()
            .clear()
            .type(panelTitle);
        }

        if (visualizationName) {
          openOptionsGroup('type');
          e2e.components.PluginVisualization.item(visualizationName)
            .scrollIntoView()
            .click();
        }

        // Consistently closed
        closeOptionsGroup('settings');
        closeOptionsGroup('type');
        closeOptions();
      } else {
        // Consistently closed
        closeOptions();
      }
    }

    if (queriesForm) {
      queriesForm(fullConfig);
      e2e().wait('@chartData');

      // Wait for a possible complex visualization to render (or something related, as this isn't necessary on the dashboard page)
      // Can't assert that its HTML changed because a new query could produce the same results
      e2e().wait(1000);
    }

    // @todo enable when plugins have this implemented
    //e2e.components.QueryEditorRow.actionButton('Disable/enable query').click();
    //e2e().wait('@chartData');
    //e2e.components.Panels.Panel.containerByTitle(panelTitle).find('.panel-content').contains('No data');
    //e2e.components.QueryEditorRow.actionButton('Disable/enable query').click();
    //e2e().wait('@chartData');

    if (!isExplore) {
      e2e()
        .get('button[title="Apply changes and go back to dashboard"]')
        .click();
      e2e()
        .url()
        .should('include', `/d/${dashboardUid}`);
    }

    // Avoid annotations flakiness
    e2e()
      .get('.refresh-picker-buttons .btn')
      .first()
      .click();

    e2e().wait('@chartData');

    // Wait for RxJS
    e2e().wait(500);

    if (matchScreenshot) {
      let visualization;

      if (isExplore) {
        visualization = e2e.pages.Explore.General.graph();
      } else {
        visualization = e2e.components.Panels.Panel.containerByTitle(panelTitle).find('.panel-content');
      }

      visualization.scrollIntoView().screenshot(screenshotName);
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

export const VISUALIZATION_ALERT_LIST = 'Alert list';
export const VISUALIZATION_BAR_GAUGE = 'Bar gauge';
export const VISUALIZATION_CLOCK = 'Clock';
export const VISUALIZATION_DASHBOARD_LIST = 'Dashboard list';
export const VISUALIZATION_GAUGE = 'Gauge';
export const VISUALIZATION_GRAPH = 'Graph';
export const VISUALIZATION_HEAT_MAP = 'Heatmap';
export const VISUALIZATION_LOGS = 'Logs';
export const VISUALIZATION_NEWS = 'News';
export const VISUALIZATION_PIE_CHART = 'Pie Chart';
export const VISUALIZATION_PLUGIN_LIST = 'Plugin list';
export const VISUALIZATION_POLYSTAT = 'Polystat';
export const VISUALIZATION_STAT = 'Stat';
export const VISUALIZATION_TABLE = 'Table';
export const VISUALIZATION_TEXT = 'Text';
export const VISUALIZATION_WORLD_MAP = 'Worldmap Panel';
