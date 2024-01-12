import { selectors } from '@grafana/e2e-selectors';

import { e2e } from '../utils';

const DATASOURCE_ID = 'Prometheus';
// const DATASOURCE_TYPED_NAME = 'PrometheusDatasourceInstance';

type editorType = 'Code' | 'Builder';

/**
 * Login, create and save a Prometheus data source, navigate to code or builder
 *
 * @param editorType 'Code' or 'Builder'
 */
function navigateToEditor(editorType: editorType, name: string): void {
  // login
  e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), true);

  // select the prometheus DS
  e2e.pages.AddDataSource.visit();
  e2e.pages.AddDataSource.dataSourcePluginsV2(DATASOURCE_ID)
    .scrollIntoView()
    .should('be.visible') // prevents flakiness
    .click();

  // choose default editor
  e2e.components.DataSource.Prometheus.configPage.defaultEditor().scrollIntoView().should('exist').click();
  selectOption(editorType);

  // add url for DS to save without error
  e2e.components.DataSource.Prometheus.configPage.connectionSettings().type('http://prom-url:9090');

  // name the DS
  e2e.pages.DataSource.name().clear();
  e2e.pages.DataSource.name().type(name);
  e2e.pages.DataSource.saveAndTest().click();

  // visit explore
  e2e.pages.Explore.visit();

  // choose the right DS
  e2e.components.DataSourcePicker.container().should('be.visible').click();
  cy.contains(name).scrollIntoView().should('be.visible').click();
}

describe('Prometheus query editor', () => {
  it('should have a kickstart component', () => {
    navigateToEditor('Code', 'prometheus');
    e2e.components.QueryBuilder.queryPatterns().scrollIntoView().should('exist').click();
  });

  it('should have an explain component', () => {
    navigateToEditor('Code', 'prometheus');
    cy.get(`#${selectors.components.DataSource.Prometheus.queryEditor.explain}`).scrollIntoView().should('exist');
  });

  it('should have an editor toggle component', () => {
    navigateToEditor('Code', 'prometheus');
    e2e.components.DataSource.Prometheus.queryEditor.editorToggle().scrollIntoView().should('exist');
  });

  it('should have an options component with legend, format, step, type and exemplars', () => {
    navigateToEditor('Code', 'prometheus');
    // open options
    e2e.components.DataSource.Prometheus.queryEditor.options().scrollIntoView().should('exist').click();
    // check options
    cy.get(`#${selectors.components.DataSource.Prometheus.queryEditor.legend}`).scrollIntoView().should('exist');
    e2e.components.DataSource.Prometheus.queryEditor.format().scrollIntoView().should('exist');
    cy.get(`#${selectors.components.DataSource.Prometheus.queryEditor.step}`).scrollIntoView().should('exist');
    e2e.components.DataSource.Prometheus.queryEditor.type().scrollIntoView().should('exist');
    cy.get(`#${selectors.components.DataSource.Prometheus.queryEditor.exemplars}`).scrollIntoView().should('exist');
  });

  describe('Code editor', () => {
    it('navigates to the code editor with editor type as code', () => {
      navigateToEditor('Code', 'prometheusCode');
    });
  });

  describe('Query builder', () => {
    it('navigates to the query builder with editor type as code', () => {
      navigateToEditor('Builder', 'prometheusBuilder');
    });
  });
});

export function selectOption(option: string) {
  cy.get("[aria-label='Select option']").contains(option).should('be.visible').click();
}
