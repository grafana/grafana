import { e2e } from '../utils';

describe.skip('ReturnToPrevious button', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));

    cy.visit('/alerting/list');
    e2e.components.AlertRules.groupToggle().first().click();
    e2e.components.AlertRules.toggle().click();
    cy.get('a[title="View"]').click();
    cy.url().as('alertRuleUrl');
    cy.get('a').contains('View panel').click();
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
    cy.get('@alertRuleUrl').then((alertRuleUrl) => {
      cy.url().should('eq', alertRuleUrl);
    });
  });

  it('should disappear when clicking "Dismiss"', () => {
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

  it('should override the button label and change the href when user changes alert rules', () => {
    e2e.components.ReturnToPrevious.backButton()
      .find('span')
      .contains('Back to e2e-ReturnToPrevious-test')
      .should('be.visible');

    cy.visit('/alerting/list');

    e2e.components.AlertRules.groupToggle().last().click();
    cy.get('a[title="View"]').click();
    cy.url().as('alertRule2Url');
    cy.get('a').contains('View panel').click();

    e2e.components.ReturnToPrevious.backButton()
      .find('span')
      .contains('Back to e2e-ReturnToPrevious-test-2')
      .should('be.visible')
      .click();

    e2e.components.ReturnToPrevious.buttonGroup().should('not.exist');

    // check whether the RTP button leads back to alert rule
    cy.get('@alertRule2Url').then((alertRule2Url) => {
      cy.url().should('eq', alertRule2Url);
    });
  });
});
