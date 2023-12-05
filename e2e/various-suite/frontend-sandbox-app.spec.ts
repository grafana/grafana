import { e2e } from '../utils';

const APP_ID = 'sandbox-app-test';

describe('Datasource sandbox', () => {
  before(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), true);
    cy.request({
      url: `${Cypress.env('BASE_URL')}/api/plugins/${APP_ID}/settings`,
      method: 'POST',
      body: {
        enabled: true,
      },
    });
  });
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), true);
  });

  describe('App Page', () => {
    describe('Sandbox disabled', () => {
      beforeEach(() => {
        cy.window().then((win) => {
          win.localStorage.setItem('grafana.featureToggles', 'pluginsFrontendSandbox=0');
        });
      });

      it('Loads the app page without the sandbox div wrapper', () => {
        e2e.pages.Home.visit();
        e2e.components.NavBar.Toggle.button().click();
        e2e.components.NavToolbar.container().get('[aria-label="Expand section Apps"]').click();
        e2e.components.NavMenu.item().contains('Sandbox app test plugin').click();
        cy.wait(200); // wait to prevent false positives because cypress checks too fast
        cy.get('div[data-plugin-sandbox="sandbox-app-test"]').should('not.exist');
        cy.get('div[data-testid="sandbox-app-test-page-one"]').should('exist');
      });

      it('Loads the app configuration without the sandbox div wrapper', () => {
        e2e.pages.Home.visit();
        e2e.components.NavBar.Toggle.button().click();
        e2e.components.NavToolbar.container().get('[aria-label="Expand section Apps"]').click();
        e2e.components.NavMenu.item().contains('Apps').click();
        cy.get('a[aria-label="Tab Sandbox App Page"]').click();
        cy.wait(200); // wait to prevent false positives because cypress checks too fast
        cy.get('div[data-plugin-sandbox="sandbox-app-test"]').should('not.exist');
        cy.get('div[data-testid="sandbox-app-test-config-page"]').should('exist');
      });
    });

    describe('Sandbox enabled', () => {
      beforeEach(() => {
        cy.window().then((win) => {
          win.localStorage.setItem('grafana.featureToggles', 'pluginsFrontendSandbox=1');
        });
      });

      it('Loads the app page with the sandbox div wrapper', () => {
        e2e.pages.Home.visit();
        e2e.components.NavBar.Toggle.button().click();
        e2e.components.NavToolbar.container().get('[aria-label="Expand section Apps"]').click();
        e2e.components.NavMenu.item().contains('Sandbox app test plugin').click();
        cy.get('div[data-plugin-sandbox="sandbox-app-test"]').should('exist');
        cy.get('div[data-testid="sandbox-app-test-page-one"]').should('exist');
      });

      it('Loads the app configuration with the sandbox div wrapper', () => {
        e2e.pages.Home.visit();
        e2e.components.NavBar.Toggle.button().click();
        e2e.components.NavToolbar.container().get('[aria-label="Expand section Apps"]').click();
        e2e.components.NavMenu.item().contains('Apps').click();
        cy.get('a[aria-label="Tab Sandbox App Page"]').click();
        cy.get('div[data-plugin-sandbox="sandbox-app-test"]').should('exist');
        cy.get('div[data-testid="sandbox-app-test-config-page"]').should('exist');
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
