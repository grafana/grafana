import panelSandboxDashboard from '../dashboards/PanelSandboxDashboard.json';
import { e2e } from '../utils';

const DASHBOARD_ID = 'c46b2460-16b7-42a5-82d1-b07fbf431950';
// Skipping due to race conditions with same old arch test e2e/panels-suite/frontend-sandbox-panel.spec.ts
describe('Panel sandbox', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), true);
    return e2e.flows.importDashboard(panelSandboxDashboard, 1000, true);
  });

  describe('Sandbox disabled', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        win.localStorage.setItem('grafana.featureToggles', 'pluginsFrontendSandbox=0');
      });
      cy.reload();
    });

    it('Add iframes to body', () => {
      // this button adds iframes to the body
      cy.get('[data-testid="button-create-iframes"]').click();

      const iframeIds = [
        'createElementIframe',
        'innerHTMLIframe',
        'appendIframe',
        'prependIframe',
        'afterIframe',
        'beforeIframe',
        'outerHTMLIframe',
        'parseFromStringIframe',
        'insertBeforeIframe',
        'replaceChildIframe',
      ];
      iframeIds.forEach((id) => {
        cy.get(`#${id}`).should('exist');
      });
    });

    it('Reaches out of panel div', () => {
      // this button reaches out of the panel div and modifies the element dataset
      cy.get('[data-testid="button-reach-out"]').click();

      cy.get('[data-sandbox-test="true"]').should('exist');
    });

    it('Reaches out of the panel editor', () => {
      e2e.flows.openDashboard({
        uid: DASHBOARD_ID,
        queryParams: {
          editPanel: 1,
        },
      });

      cy.get('[data-testid="panel-editor-custom-editor-input"]').should('not.be.disabled');
      cy.get('[data-testid="panel-editor-custom-editor-input"]').should('have.value', '');
      // wait because sometimes cypress is faster than react and the value doesn't change
      cy.wait(1000);
      cy.get('[data-testid="panel-editor-custom-editor-input"]').type('x', { force: true, delay: 500 });
      cy.wait(100); // small delay to prevent false positives from too fast tests
      cy.get('[data-testid="panel-editor-custom-editor-input"]').should('have.value', 'x');
      cy.get('[data-sandbox-test="panel-editor"]').should('exist');
    });
  });

  describe('Sandbox enabled', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        win.localStorage.setItem('grafana.featureToggles', 'pluginsFrontendSandbox=1');
      });
      cy.reload();
    });

    it('Does not add iframes to body', () => {
      // this button adds 3 iframes to the body
      cy.get('[data-testid="button-create-iframes"]').click();
      cy.wait(100); // small delay to prevent false positives from too fast tests

      const iframeIds = [
        'createElementIframe',
        'innerHTMLIframe',
        'appendIframe',
        'prependIframe',
        'afterIframe',
        'beforeIframe',
        'outerHTMLIframe',
        'parseFromStringIframe',
        'insertBeforeIframe',
        'replaceChildIframe',
      ];
      iframeIds.forEach((id) => {
        cy.get(`#${id}`).should('not.exist');
      });
    });

    it('Does not reaches out of panel div', () => {
      // this button reaches out of the panel div and modifies the element dataset
      cy.get('[data-testid="button-reach-out"]').click();
      cy.wait(100); // small delay to prevent false positives from too fast tests
      cy.get('[data-sandbox-test="true"]').should('not.exist');
    });

    it('Does not Reaches out of the panel editor', () => {
      e2e.flows.openDashboard({
        uid: DASHBOARD_ID,
        queryParams: {
          editPanel: 1,
        },
      });

      cy.get('[data-testid="panel-editor-custom-editor-input"]').should('not.be.disabled');
      // wait because sometimes cypress is faster than react and the value doesn't change
      cy.wait(1000);
      cy.get('[data-testid="panel-editor-custom-editor-input"]').type('x', { force: true });
      cy.wait(100); // small delay to prevent false positives from too fast tests
      cy.get('[data-sandbox-test="panel-editor"]').should('not.exist');
    });

    it('Can access specific window global variables', () => {
      cy.get('[data-testid="button-test-globals"]').click();
      cy.get('[data-sandbox-global="Prism"]').should('be.visible');
      cy.get('[data-sandbox-global="jQuery"]').should('be.visible');
      cy.get('[data-sandbox-global="location"]').should('be.visible');
    });
  });

  afterEach(() => {
    e2e.flows.revertAllChanges();
  });

  after(() => {
    return cy.clearCookies();
  });
});
