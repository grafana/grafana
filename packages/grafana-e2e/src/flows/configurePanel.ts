import { e2e } from '../index';
import { getLocalStorage, requireLocalStorage } from '../support/localStorage';
import { getScenarioContext } from '../support/scenarioContext';
import { selectOption } from './selectOption';
import { setDashboardTimeRange } from './setDashboardTimeRange';
import { setTimeRange, TimeRangeConfig } from './setTimeRange';

interface AddPanelOverrides {
  dataSourceName: string;
  queriesForm: (config: AddPanelConfig) => void;
  panelTitle: string;
}

interface EditPanelOverrides {
  queriesForm?: (config: EditPanelConfig) => void;
  panelTitle: string;
}

interface ConfigurePanelDefault {
  chartData: {
    method: string;
    route: string | RegExp;
  };
  dashboardUid: string;
  matchScreenshot: boolean;
  saveDashboard: boolean;
  screenshotName: string;
  visitDashboardAtStart: boolean; // @todo remove when possible
}

interface ConfigurePanelOptional {
  dataSourceName?: string;
  queriesForm?: (config: ConfigurePanelConfig) => void;
  panelTitle?: string;
  timeRange?: TimeRangeConfig;
  visualizationName?: string;
}

interface ConfigurePanelRequired {
  isEdit: boolean;
  isExplore: boolean;
}

export type PartialConfigurePanelConfig = Partial<ConfigurePanelDefault> &
  ConfigurePanelOptional &
  ConfigurePanelRequired;

export type ConfigurePanelConfig = ConfigurePanelDefault & ConfigurePanelOptional & ConfigurePanelRequired;

export type PartialAddPanelConfig = PartialConfigurePanelConfig & AddPanelOverrides;
export type AddPanelConfig = ConfigurePanelConfig & AddPanelOverrides;

export type PartialEditPanelConfig = PartialConfigurePanelConfig & EditPanelOverrides;
export type EditPanelConfig = ConfigurePanelConfig & EditPanelOverrides;

// @todo this actually returns type `Cypress.Chainable<AddPanelConfig | EditPanelConfig | ConfigurePanelConfig>`
export const configurePanel = (config: PartialAddPanelConfig | PartialEditPanelConfig | PartialConfigurePanelConfig) =>
  getScenarioContext().then(({ lastAddedDashboardUid }: any) => {
    const fullConfig: AddPanelConfig | EditPanelConfig | ConfigurePanelConfig = {
      chartData: {
        method: 'POST',
        route: '/api/ds/query',
      },
      dashboardUid: lastAddedDashboardUid,
      matchScreenshot: false,
      saveDashboard: true,
      screenshotName: 'panel-visualization',
      visitDashboardAtStart: true,
      ...config,
    };

    const {
      chartData,
      dashboardUid,
      dataSourceName,
      isEdit,
      isExplore,
      matchScreenshot,
      panelTitle,
      queriesForm,
      screenshotName,
      timeRange,
      visitDashboardAtStart,
      visualizationName,
    } = fullConfig;

    if (isEdit && isExplore) {
      throw new TypeError('Invalid configuration');
    }

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
      selectOption({
        container: e2e.components.DataSourcePicker.container(),
        optionText: dataSourceName,
      });
    }

    // @todo instead wait for '@pluginModule' if not already loaded
    e2e().wait(2000);

    if (!isExplore) {
      if (!isEdit) {
        // Fields could be covered due to an empty query editor
        closeRequestErrors();
      }

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
            .type(panelTitle as string);
        }

        if (visualizationName) {
          openOptionsGroup('type');
          e2e.components.PluginVisualization.item(visualizationName)
            .scrollIntoView()
            .click();

          // @todo wait for '@pluginModule' if not a core visualization and not already loaded
          e2e().wait(2000);
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

const closeRequestErrors = () => {
  e2e().wait(1000); // emulate `cy.get()` for nested errors
  e2e()
    .get('app-notifications-list')
    .then($elm => {
      // Avoid failing when none are found
      const selector = '[aria-label="Alert error"]:contains("Failed to call resource")';
      const numErrors = $elm.find(selector).length;

      for (let i = 0; i < numErrors; i++) {
        e2e()
          .get(selector)
          .first()
          .find('button')
          .click();
      }
    });
};

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
