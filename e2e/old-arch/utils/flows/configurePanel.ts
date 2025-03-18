import { e2e } from '..';
import { getScenarioContext } from '../support/scenarioContext';

import { setDashboardTimeRange } from './setDashboardTimeRange';
import { TimeRangeConfig } from './setTimeRange';

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
  saveDashboard: boolean;
  visitDashboardAtStart: boolean; // @todo remove when possible
}

interface ConfigurePanelOptional {
  dataSourceName?: string;
  queriesForm?: (config: ConfigurePanelConfig) => void;
  panelTitle?: string;
  timeRange?: TimeRangeConfig;
  visualizationName?: string;
  timeout?: number;
}

interface ConfigurePanelRequired {
  isEdit: boolean;
}

export type PartialConfigurePanelConfig = Partial<ConfigurePanelDefault> &
  ConfigurePanelOptional &
  ConfigurePanelRequired;

export type ConfigurePanelConfig = ConfigurePanelDefault & ConfigurePanelOptional & ConfigurePanelRequired;

export type PartialAddPanelConfig = PartialConfigurePanelConfig & AddPanelOverrides;
export type AddPanelConfig = ConfigurePanelConfig & AddPanelOverrides;

export type PartialEditPanelConfig = PartialConfigurePanelConfig & EditPanelOverrides;
export type EditPanelConfig = ConfigurePanelConfig & EditPanelOverrides;

export const configurePanel = (config: PartialAddPanelConfig | PartialEditPanelConfig | PartialConfigurePanelConfig) =>
  getScenarioContext().then(({ lastAddedDashboardUid }) => {
    const fullConfig: AddPanelConfig | EditPanelConfig | ConfigurePanelConfig = {
      chartData: {
        method: 'POST',
        route: '/api/ds/query',
      },
      dashboardUid: lastAddedDashboardUid,
      saveDashboard: true,
      visitDashboardAtStart: true,
      ...config,
    };

    const {
      chartData,
      dashboardUid,
      dataSourceName,
      isEdit,
      panelTitle,
      queriesForm,
      timeRange,
      visitDashboardAtStart,
      visualizationName,
      timeout,
    } = fullConfig;

    if (visitDashboardAtStart) {
      e2e.flows.openDashboard({ uid: dashboardUid });
    }

    if (isEdit) {
      e2e.components.Panels.Panel.title(panelTitle).click();
      e2e.components.Panels.Panel.headerItems('Edit').click();
    } else {
      try {
        e2e.components.PageToolbar.itemButton('Add button').should('be.visible');
        e2e.components.PageToolbar.itemButton('Add button').click();
      } catch (e) {
        // Depending on the screen size, the "Add" button might be hidden
        e2e.components.PageToolbar.item('Show more items').click();
        e2e.components.PageToolbar.item('Add button').last().click();
      }
      e2e.pages.AddDashboard.itemButton('Add new visualization menu item').should('be.visible');
      e2e.pages.AddDashboard.itemButton('Add new visualization menu item').click();
    }

    if (timeRange) {
      setDashboardTimeRange(timeRange);
    }

    // @todo alias '/**/*.js*' as '@pluginModule' when possible: https://github.com/cypress-io/cypress/issues/1296

    cy.intercept(chartData.method, chartData.route).as('chartData');

    if (dataSourceName) {
      e2e.components.DataSourcePicker.container().click().type(`${dataSourceName}{downArrow}{enter}`);
    }

    // @todo instead wait for '@pluginModule' if not already loaded
    cy.wait(2000);

    // `panelTitle` is needed to edit the panel, and unlikely to have its value changed at that point
    const changeTitle = panelTitle && !isEdit;

    if (changeTitle || visualizationName) {
      if (changeTitle && panelTitle) {
        e2e.components.PanelEditor.OptionsPane.fieldLabel('Panel options Title').type(`{selectall}${panelTitle}`);
      }

      if (visualizationName) {
        e2e.components.PluginVisualization.item(visualizationName).scrollIntoView().click();

        // @todo wait for '@pluginModule' if not a core visualization and not already loaded
        cy.wait(2000);
      }
    } else {
      // Consistently closed
      closeOptions();
    }

    if (queriesForm) {
      queriesForm(fullConfig);

      // Wait for a possible complex visualization to render (or something related, as this isn't necessary on the dashboard page)
      // Can't assert that its HTML changed because a new query could produce the same results
      cy.wait(1000);
    }

    // @todo enable when plugins have this implemented
    //e2e.components.QueryEditorRow.actionButton('Disable/enable query').click();
    //cy.wait('@chartData');
    //e2e.components.Panels.Panel.containerByTitle(panelTitle).find('.panel-content').contains('No data');
    //e2e.components.QueryEditorRow.actionButton('Disable/enable query').click();
    //cy.wait('@chartData');

    // Avoid annotations flakiness
    e2e.components.RefreshPicker.runButtonV2().first().click({ force: true });

    // Wait for RxJS
    cy.wait(timeout ?? Cypress.config().defaultCommandTimeout);

    // @todo remove `wrap` when possible
    return cy.wrap({ config: fullConfig }, { log: false });
  });

const closeOptions = () => e2e.components.PanelEditor.toggleVizOptions().click();

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
