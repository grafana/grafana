import { selectors } from '@grafana/e2e-selectors';

import { e2e } from '../utils';

const DATASOURCE_ID = 'Prometheus';
const DATASOURCE_TYPED_NAME = 'PrometheusDatasourceInstance';

describe('Prometheus config', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), true);

    e2e.pages.AddDataSource.visit();
    e2e.pages.AddDataSource.dataSourcePluginsV2(DATASOURCE_ID)
      .scrollIntoView()
      .should('be.visible') // prevents flakiness
      .click({ force: true });
  });

  it(`should have the following components:
        connection settings
        managed alerts
        scrape interval
        query timeout
        default editor
        disable metric lookup
        prometheus type
        cache level
        incremental querying
        disable recording rules
        custom query parameters
        http method
      `, () => {
    // connection settings
    e2e.components.DataSource.Prometheus.configPage.connectionSettings().should('be.visible');
    // managed alerts
    cy.get(`#${selectors.components.DataSource.Prometheus.configPage.manageAlerts}`).scrollIntoView().should('exist');
    // scrape interval
    e2e.components.DataSource.Prometheus.configPage.scrapeInterval().scrollIntoView().should('exist');
    // query timeout
    e2e.components.DataSource.Prometheus.configPage.queryTimeout().scrollIntoView().should('exist');
    // default editor
    e2e.components.DataSource.Prometheus.configPage.defaultEditor().scrollIntoView().should('exist');
    // disable metric lookup
    cy.get(`#${selectors.components.DataSource.Prometheus.configPage.disableMetricLookup}`)
      .scrollIntoView()
      .should('exist');
    // prometheus type
    e2e.components.DataSource.Prometheus.configPage.prometheusType().scrollIntoView().should('exist');
    // cache level
    e2e.components.DataSource.Prometheus.configPage.cacheLevel().scrollIntoView().should('exist');
    // incremental querying
    cy.get(`#${selectors.components.DataSource.Prometheus.configPage.incrementalQuerying}`)
      .scrollIntoView()
      .should('exist');
    // disable recording rules
    cy.get(`#${selectors.components.DataSource.Prometheus.configPage.disableRecordingRules}`)
      .scrollIntoView()
      .should('exist');
    // custom query parameters
    e2e.components.DataSource.Prometheus.configPage.customQueryParameters().scrollIntoView().should('exist');
    // http method
    e2e.components.DataSource.Prometheus.configPage.httpMethod().scrollIntoView().should('exist');
  });

  it('should save the default editor when navigating to explore', () => {
    e2e.components.DataSource.Prometheus.configPage.defaultEditor().scrollIntoView().should('exist').click();

    selectOption('Builder');

    e2e.components.DataSource.Prometheus.configPage.connectionSettings().type('http://prom-url:9090');

    e2e.pages.DataSource.name().clear();
    e2e.pages.DataSource.name().type(DATASOURCE_TYPED_NAME);
    e2e.pages.DataSource.saveAndTest().click();

    e2e.pages.Explore.visit();

    e2e.components.DataSourcePicker.container().should('be.visible').click();

    e2e.components.DataSourcePicker.container().type(`${DATASOURCE_TYPED_NAME}{enter}`);

    e2e.components.DataSource.Prometheus.queryEditor.builder.metricSelect().should('exist');
  });

  it('should allow a user to add the version when the Prom type is selected', () => {
    e2e.components.DataSource.Prometheus.configPage.prometheusType().scrollIntoView().should('exist').click();

    selectOption('Prometheus');

    e2e.components.DataSource.Prometheus.configPage.prometheusVersion().scrollIntoView().should('exist');
  });

  it('should have a cache level component', () => {
    e2e.components.DataSource.Prometheus.configPage.cacheLevel().scrollIntoView().should('exist');
  });

  it('should allow a user to select a query overlap window when incremental querying is selected', () => {
    cy.get(`#${selectors.components.DataSource.Prometheus.configPage.incrementalQuerying}`)
      .scrollIntoView()
      .should('exist')
      .check({ force: true });

    e2e.components.DataSource.Prometheus.configPage.queryOverlapWindow().scrollIntoView().should('exist');
  });

  // exemplars tested in exemplar.spec
});

function selectOption(option: string) {
  cy.get('[role="option"]').filter(`:contains("${option}")`).should('be.visible').click();
}
