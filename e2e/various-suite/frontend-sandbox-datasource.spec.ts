import { random } from 'lodash';

import { e2e } from '../utils';

const DATASOURCE_ID = 'sandbox-test-datasource';
let DATASOURCE_CONNECTION_ID = '';
const DATASOURCE_TYPED_NAME = 'SandboxDatasourceInstance';

// Skipping due to flakiness/race conditions with same old arch test  e2e/various-suite/frontend-sandbox-datasource.spec.ts
describe('Datasource sandbox', () => {
  before(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), true);

    e2e.pages.AddDataSource.visit();
    e2e.pages.AddDataSource.dataSourcePluginsV2('Sandbox datasource test plugin')
      .scrollIntoView()
      .should('be.visible') // prevents flakiness
      .click();
    e2e.pages.DataSource.name().clear();
    e2e.pages.DataSource.name().type(DATASOURCE_TYPED_NAME);
    e2e.pages.DataSource.saveAndTest().click();
    cy.url().then((url) => {
      const split = url.split('/');
      DATASOURCE_CONNECTION_ID = split[split.length - 1];
    });
  });
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), true);
  });

  describe('Config Editor', () => {
    describe('Sandbox disabled', () => {
      beforeEach(() => {
        cy.window().then((win) => {
          win.localStorage.setItem('grafana.featureToggles', 'pluginsFrontendSandbox=0');
        });
      });
      it('Should not render a sandbox wrapper around the datasource config editor', () => {
        e2e.pages.EditDataSource.visit(DATASOURCE_CONNECTION_ID);
        cy.wait(300); // wait to prevent false positives because cypress checks too fast
        cy.get(`div[data-plugin-sandbox="${DATASOURCE_ID}"]`).should('not.exist');
      });
    });

    describe('Sandbox enabled', () => {
      beforeEach(() => {
        cy.window().then((win) => {
          win.localStorage.setItem('grafana.featureToggles', 'pluginsFrontendSandbox=1');
        });
      });

      it('Should render a sandbox wrapper around the datasource config editor', () => {
        e2e.pages.EditDataSource.visit(DATASOURCE_CONNECTION_ID);
        cy.get(`div[data-plugin-sandbox="${DATASOURCE_ID}"]`).should('exist');
      });

      it('Should store values in jsonData and secureJsonData correctly', () => {
        e2e.pages.EditDataSource.visit(DATASOURCE_CONNECTION_ID);

        const valueToStore = 'test' + random(100);

        cy.get('[data-testid="sandbox-config-editor-query-input"]').should('not.be.disabled');
        cy.get('[data-testid="sandbox-config-editor-query-input"]').type(valueToStore);
        cy.get('[data-testid="sandbox-config-editor-query-input"]').should('have.value', valueToStore);

        e2e.pages.DataSource.saveAndTest().click();
        e2e.pages.DataSource.alert().should('exist').contains('Sandbox Success', {});

        // validate the value was stored
        e2e.pages.EditDataSource.visit(DATASOURCE_CONNECTION_ID);
        cy.get('[data-testid="sandbox-config-editor-query-input"]').should('not.be.disabled');
        cy.get('[data-testid="sandbox-config-editor-query-input"]').should('have.value', valueToStore);
      });
    });
  });

  describe('Explore Page', () => {
    describe('Sandbox disabled', () => {
      beforeEach(() => {
        cy.window().then((win) => {
          win.localStorage.setItem('grafana.featureToggles', 'pluginsFrontendSandbox=0');
        });
      });

      it('Should not wrap the query editor in a sandbox wrapper', () => {
        e2e.pages.Explore.visit();
        e2e.components.DataSourcePicker.container().should('be.visible').click();
        cy.contains(DATASOURCE_TYPED_NAME).scrollIntoView().should('be.visible').click();

        // make sure the datasource was correctly selected and rendered
        e2e.components.Breadcrumbs.breadcrumb(DATASOURCE_TYPED_NAME).should('be.visible');

        cy.wait(300); // wait to prevent false positives because cypress checks too fast
        cy.get(`div[data-plugin-sandbox="${DATASOURCE_ID}"]`).should('not.exist');
      });

      it('Should accept values when typed', () => {
        e2e.pages.Explore.visit();
        e2e.components.DataSourcePicker.container().should('be.visible').click();
        cy.contains(DATASOURCE_TYPED_NAME).scrollIntoView().should('be.visible').click();
        // make sure the datasource was correctly selected and rendered
        e2e.components.Breadcrumbs.breadcrumb(DATASOURCE_TYPED_NAME).should('be.visible');

        const valueToType = 'test' + random(100);

        cy.get('[data-testid="sandbox-query-editor-query-input"]').should('not.be.disabled');
        cy.get('[data-testid="sandbox-query-editor-query-input"]').type(valueToType);
        cy.get('[data-testid="sandbox-query-editor-query-input"]').should('have.value', valueToType);
      });
    });

    describe('Sandbox enabled', () => {
      beforeEach(() => {
        cy.window().then((win) => {
          win.localStorage.setItem('grafana.featureToggles', 'pluginsFrontendSandbox=1');
        });
      });

      it('Should wrap the query editor in a sandbox wrapper', () => {
        e2e.pages.Explore.visit();
        e2e.components.DataSourcePicker.container().should('be.visible').click();
        cy.contains(DATASOURCE_TYPED_NAME).scrollIntoView().should('be.visible').click();
        // make sure the datasource was correctly selected and rendered
        e2e.components.Breadcrumbs.breadcrumb(DATASOURCE_TYPED_NAME).should('be.visible');

        cy.get(`div[data-plugin-sandbox="${DATASOURCE_ID}"]`).should('exist');
      });

      it('Should accept values when typed', () => {
        e2e.pages.Explore.visit();
        e2e.components.DataSourcePicker.container().should('be.visible').click();
        cy.contains(DATASOURCE_TYPED_NAME).scrollIntoView().should('be.visible').click();
        // make sure the datasource was correctly selected and rendered
        e2e.components.Breadcrumbs.breadcrumb(DATASOURCE_TYPED_NAME).should('be.visible');

        const valueToType = 'test' + random(100);

        cy.get('[data-testid="sandbox-query-editor-query-input"]').should('not.be.disabled');
        cy.get('[data-testid="sandbox-query-editor-query-input"]').type(valueToType);
        cy.get('[data-testid="sandbox-query-editor-query-input"]').should('have.value', valueToType);

        // typing the query editor should reflect in the url
        cy.url().should('include', valueToType);
      });
    });
  });

  afterEach(() => {
    e2e.flows.revertAllChanges();
  });

  after(() => {
    cy.clearCookies();
  });
});
