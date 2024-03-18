import { e2e } from '../utils';

describe('ReturnToPrevious button', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    cy.window().then((win) => {
      win.localStorage.setItem('grafana.featureToggles', 'returnToPrevious=1');
    });

    cy.visit('/alerting/list');
    e2e.components.AlertRules.groupToggle().first().click();
    e2e.components.AlertRules.toggle().click();
    cy.get('a[title="View"]').click();
    cy.url().as('originalUrl');
    e2e.components.AlertRules.toDashboard().click();
  });

  it('should appear when changing context and go back to alert rule when clicking "Back"', () => {
    // check whether all elements of RTP are available
    e2e.components.ReturnToPrevious.buttonGroup().should('be.visible');
    e2e.components.ReturnToPrevious.dismissButton().should('be.visible');
    e2e.components.ReturnToPrevious.backButton()
      .find('span')
      .contains('Back to e2e-ReturnToPrevious-test')
      .should('be.visible')
      .click();

    // check whether the RTP button leads back to alert rule
    cy.get('@originalUrl').then((originalUrl) => {
      cy.url().should('eq', originalUrl);
    });
  });

  it('should disappear and clear session storage when clicking "Dismiss"', () => {
    e2e.components.ReturnToPrevious.dismissButton().should('be.visible').click();
    e2e.components.ReturnToPrevious.buttonGroup().should('not.exist');
  });

  it('should not persist when going back to the alert rule details view', () => {
    e2e.components.ReturnToPrevious.buttonGroup().should('be.visible');

    cy.visit('/alerting/list');
    e2e.components.AlertRules.groupToggle().first().click();
    cy.get('a[title="View"]').click();
    e2e.components.ReturnToPrevious.buttonGroup().should('not.exist');
  });

  it('should override the information in session storage when user changes alert rules', () => {
    // check whether all elements of RTP are available
    e2e.components.ReturnToPrevious.buttonGroup().should('be.visible');
    e2e.components.ReturnToPrevious.dismissButton().should('be.visible');
    e2e.components.ReturnToPrevious.backButton()
      .find('span')
      .contains('Back to e2e-ReturnToPrevious-test')
      .should('be.visible');

    cy.visit('/alerting/list');

    e2e.components.AlertRules.groupToggle().last().click();
    cy.get('a[title="View"]').click();
    cy.url().as('secondUrl');
    e2e.components.AlertRules.toDashboard().click();

    e2e.components.ReturnToPrevious.buttonGroup().should('be.visible');
    e2e.components.ReturnToPrevious.dismissButton().should('be.visible');
    e2e.components.ReturnToPrevious.backButton()
      .find('span')
      .contains('Back to e2e-ReturnToPrevious-test-2')
      .should('be.visible')
      .click();

    e2e.components.ReturnToPrevious.buttonGroup().should('not.exist');

    // check whether the RTP button leads back to alert rule
    cy.get('@secondUrl').then((secondUrl) => {
      cy.url().should('eq', secondUrl);
    });
  });
});
