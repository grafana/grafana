import { e2e } from '../../utils';

/**
 * Create a Prom data source
 */
export function createPromDS(dataSourceID: string, name: string): void {
  // login
  e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), true);

  // select the prometheus DS
  e2e.pages.AddDataSource.visit();
  e2e.pages.AddDataSource.dataSourcePluginsV2(dataSourceID)
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

export function getResources() {
  cy.intercept(/__name__/g, metricResponse).as('getMetricNames');

  cy.intercept(/metadata/g, metadataResponse).as('getMetadata');

  cy.intercept(/labels/g, labelsResponse).as('getLabels');
}

const metricResponse = {
  status: 'success',
  data: ['metric1', 'metric2'],
};

const metadataResponse = {
  status: 'success',
  data: {
    metric1: [
      {
        type: 'counter',
        help: 'metric1 help',
        unit: '',
      },
    ],
    metric2: [
      {
        type: 'counter',
        help: 'metric2 help',
        unit: '',
      },
    ],
  },
};

const labelsResponse = {
  status: 'success',
  data: ['__name__', 'action', 'active', 'backend'],
};
