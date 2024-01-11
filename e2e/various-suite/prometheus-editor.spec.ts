// import { selectors } from '@grafana/e2e-selectors';

import { e2e } from '../utils';

import { selectOption } from './prometheus-config.spec';

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
