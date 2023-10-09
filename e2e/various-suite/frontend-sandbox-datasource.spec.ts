import { e2e } from '../utils';

const DATASOURCE_ID = 'sandbox-test-datasource';
let DATASOURCE_CONNECTION_ID = '';
const DATASOURCE_TYPED_NAME = 'sandbox datasource ' + (Math.random() * 100).toFixed(0);

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
        cy.visit('connections/datasources/edit/' + DATASOURCE_CONNECTION_ID);
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
        cy.visit('connections/datasources/edit/' + DATASOURCE_CONNECTION_ID);
        cy.get(`div[data-plugin-sandbox="${DATASOURCE_ID}"]`).should('exist');
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

        cy.get(`div[data-plugin-sandbox="${DATASOURCE_ID}"]`).should('not.exist');
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

        cy.get(`div[data-plugin-sandbox="${DATASOURCE_ID}"]`).should('not.exist');
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
