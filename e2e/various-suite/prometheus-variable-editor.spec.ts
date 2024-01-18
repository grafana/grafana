import { e2e } from '../utils';
import { addDashboard } from '../utils/flows';

import { getResources } from './helpers/prometheus-helpers';

const DATASOURCE_ID = 'Prometheus';

const DATASOURCE_NAME = 'prometheusVariableDS';

/**
 * Create a Prom data source
 */
function createPromDS(name: string): void {
  // login
  e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), true);

  // select the prometheus DS
  e2e.pages.AddDataSource.visit();
  e2e.pages.AddDataSource.dataSourcePluginsV2(DATASOURCE_ID)
    .scrollIntoView()
    .should('be.visible') // prevents flakiness
    .click();

  // add url for DS to save without error
  e2e.components.DataSource.Prometheus.configPage.connectionSettings().type('http://prom-url:9090');

  // name the DS
  e2e.pages.DataSource.name().clear();
  e2e.pages.DataSource.name().type(name);
  e2e.pages.DataSource.saveAndTest().click();
}

/**
 * Click dashboard settings and then the variables tab
 */
function navigateToVariables() {
  e2e.components.PageToolbar.item('Dashboard settings').click();
  e2e.components.Tab.title('Variables').click();
}

/**
 * Begin the process of adding a query type variable for a Prometheus data source
 *
 * @param variableName the name of the variable as a label of the variable dropdown
 */
function addPrometheusQueryVariable(variableName: string) {
  e2e.pages.Dashboard.Settings.Variables.List.addVariableCTAV2().click();

  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2().clear().type(variableName);
  e2e.components.DataSourcePicker.container().should('be.visible').click();
  cy.contains(DATASOURCE_NAME).scrollIntoView().should('be.visible').click();

  getResources();
}

/**
 * Create a Prometheus variable and navigate to the query editor to check that it is available to use.
 *
 * @param variableName name the variable
 * @param queryType query type of 'Label names', 'Label values', 'Metrics', 'Query result', 'Series query' or 'Classic query'. These types should be imported from the Prometheus library eventually but not now because we are in the process of decoupling the DS from core grafana.
 */
function variableFlowToQueryEditor(variableName: string, queryType: string) {
  addDashboard();
  navigateToVariables();
  addPrometheusQueryVariable(variableName);

  // select query type
  e2e.components.DataSource.Prometheus.variableQueryEditor.queryType().click();
  selectOption(queryType);

  // apply the variable
  e2e.pages.Dashboard.Settings.Variables.Edit.General.applyButton().click();

  // close to return to dashboard
  e2e.pages.Dashboard.Settings.Actions.close().click();

  // add visualization
  e2e.pages.AddDashboard.itemButton('Create new panel button').should('be.visible').click();

  // close the data source picker modal
  cy.get('[aria-label="Close"]').click();

  // select prom data source from the data source list with the useful data-testid
  e2e.components.DataSourcePicker.inputV2().click({ force: true }).type(`${DATASOURCE_NAME}{enter}`);

  // confirm the variable exists in the correct input
  // use the variable query type from the library in the future
  switch (queryType) {
    case 'Label names':
      e2e.components.QueryBuilder.labelSelect().should('exist').click({ force: true });
    case 'Label values':
      e2e.components.QueryBuilder.valueSelect().should('exist').click({ force: true });
    case 'Metrics':
      e2e.components.DataSource.Prometheus.queryEditor.builder.metricSelect().should('exist').click({ force: true });
    default:
    // do nothing
  }
  // the variable should be present and selectable
  selectOption(`${variableName}`);
}

describe('Prometheus variable query editor', () => {
  beforeEach(() => {
    createPromDS(DATASOURCE_NAME);
  });

  it('should navigate to variable query editor', () => {
    addDashboard();
    navigateToVariables();
  });

  it('should select a query type for a Prometheus variable query', () => {
    addDashboard();
    navigateToVariables();
    addPrometheusQueryVariable('labelsVariable');

    // select query type
    e2e.components.DataSource.Prometheus.variableQueryEditor.queryType().click();

    selectOption('Label names');
  });

  it('should create a label names variable that is selectable in the label select in query builder', () => {
    addDashboard();
    navigateToVariables();
    variableFlowToQueryEditor('labelnames', 'Label names');
  });

  it('should create a label values variable that is selectable in the label values select in query builder', () => {
    addDashboard();
    navigateToVariables();
    variableFlowToQueryEditor('labelvalues', 'Label values');
  });

  it('should create a metric names variable that is selectable in the metric select in query builder', () => {
    addDashboard();
    navigateToVariables();
    variableFlowToQueryEditor('metrics', 'Metrics');
  });
});

function selectOption(option: string) {
  cy.get("[aria-label='Select option']").contains(option).should('be.visible').click();
}
