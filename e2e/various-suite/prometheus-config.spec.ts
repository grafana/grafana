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
      .click();
  });

  it('should have a connection settings component', () => {
    e2e.components.DataSource.Prometheus.configPage.connectionSettings().should('be.visible');
  });

  it('should have a managed alerts component', () => {
    cy.get(`#${selectors.components.DataSource.Prometheus.configPage.manageAlerts}`).scrollIntoView().should('exist');
  });

  it('should have a scrape interval component', () => {
    e2e.components.DataSource.Prometheus.configPage.scrapeInterval().scrollIntoView().should('exist');
  });

  it('should have a query timeout component', () => {
    e2e.components.DataSource.Prometheus.configPage.queryTimeout().scrollIntoView().should('exist');
  });

  it('should have a default editor component', () => {
    e2e.components.DataSource.Prometheus.configPage.defaultEditor().scrollIntoView().should('exist');
  });

  it('should save the default editor when navigating to explore', () => {
    e2e.components.DataSource.Prometheus.configPage.defaultEditor().scrollIntoView().should('exist').click();

    selectOption('Code');

    e2e.components.DataSource.Prometheus.configPage.connectionSettings().type('http://prom-url:9090');

    e2e.pages.DataSource.name().clear();
    e2e.pages.DataSource.name().type(DATASOURCE_TYPED_NAME);
    e2e.pages.DataSource.saveAndTest().click();

    e2e.pages.Explore.visit();

    e2e.components.DataSourcePicker.container().should('be.visible').click();
    cy.contains(DATASOURCE_TYPED_NAME).scrollIntoView().should('be.visible').click();

    const monacoLoadingText = 'Loading...';
    e2e.components.QueryField.container().should('be.visible').should('have.text', monacoLoadingText);
    e2e.components.QueryField.container().should('be.visible').should('not.have.text', monacoLoadingText);
  });

  it('should have a disable metric lookup component', () => {
    cy.get(`#${selectors.components.DataSource.Prometheus.configPage.disableMetricLookup}`)
      .scrollIntoView()
      .should('exist');
  });

  it('should have a prometheus type component', () => {
    e2e.components.DataSource.Prometheus.configPage.prometheusType().scrollIntoView().should('exist');
  });

  it('should allow a user to add the version when the Prom type is selected', () => {
    e2e.components.DataSource.Prometheus.configPage.prometheusType().scrollIntoView().should('exist').click();

    selectOption('Prometheus');

    e2e.components.DataSource.Prometheus.configPage.prometheusVersion().scrollIntoView().should('exist');
  });

  it('should have a cache level component', () => {
    e2e.components.DataSource.Prometheus.configPage.cacheLevel().scrollIntoView().should('exist');
  });

  it('should have an incremental querying component', () => {
    cy.get(`#${selectors.components.DataSource.Prometheus.configPage.incrementalQuerying}`)
      .scrollIntoView()
      .should('exist');
  });

  it('should allow a user to select a query overlap window when incremental querying is selected', () => {
    cy.get(`#${selectors.components.DataSource.Prometheus.configPage.incrementalQuerying}`)
      .scrollIntoView()
      .should('exist')
      .check({ force: true });

    e2e.components.DataSource.Prometheus.configPage.queryOverlapWindow().scrollIntoView().should('exist');
  });

  it('should have a disable recording rules component', () => {
    cy.get(`#${selectors.components.DataSource.Prometheus.configPage.disableRecordingRules}`)
      .scrollIntoView()
      .should('exist');
  });

  it('should have a custom query parameters component', () => {
    e2e.components.DataSource.Prometheus.configPage.customQueryParameters().scrollIntoView().should('exist');
  });

  it('should have an http method component', () => {
    e2e.components.DataSource.Prometheus.configPage.httpMethod().scrollIntoView().should('exist');
  });

  // exemplars tested in exemplar.spec
});

export function selectOption(option: string) {
  cy.get("[aria-label='Select option']").contains(option).should('be.visible').click();
}
