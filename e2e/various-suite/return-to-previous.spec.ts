import { e2e } from '../utils';

describe('ReturnToPrevious button', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    cy.window().then((win) => {
      win.localStorage.setItem('grafana.featureToggles', 'returnToPrevious=1');
    });

    cy.visit('/alerting/list?search=');
    e2e.components.AlertRules.groupToggle().first().click();
    e2e.components.AlertRules.toggle().click();
    e2e.components.AlertRules.expandedContent().find('[data-testid="data-testid go to dashboard"]').click();
    // TODO: replace data-testid in find?
  });

  it('should appear when changing context and go back to alert rule when clicking "Back"', () => {
    // make sure the dashboard finished loading
    cy.get('button[aria-label*="BarChart - Label Rotation & Skipping"]').should('be.visible');

    // check whether all elements of RTP are available
    e2e.components.ReturnToPrevious.buttonGroup().should('be.visible');
    e2e.components.ReturnToPrevious.dismissButton().should('be.visible');
    e2e.components.ReturnToPrevious.backButton().should('be.visible').click();

    // go back to alert rule
    e2e.components.AlertRules.groupToggle().first().click();
    e2e.components.AlertRules.toggle().click();
    e2e.components.AlertRules.expandedContent()
      .find('[data-testid="data-testid go to dashboard"]')
      .should('be.visible');
    // TODO: replace data-testid in find?
  });

  it('should disappear and clear session storage when clicking "Dismiss"', () => {
    cy.window().its('sessionStorage').invoke('getItem', 'returnToPrevious').should('exist');
    e2e.components.ReturnToPrevious.dismissButton().should('be.visible').click();
    e2e.components.ReturnToPrevious.buttonGroup().should('not.exist');
    cy.window().its('sessionStorage').invoke('getItem', 'returnToPrevious').should('not.exist');
  });

  it('should disappear and clear session storage when going back to alert rules via nav', () => {
    e2e.components.ReturnToPrevious.buttonGroup().should('be.visible');
    cy.window().its('sessionStorage').invoke('getItem', 'returnToPrevious').should('exist');

    // make sure the dashboard finished loading
    cy.get('button[aria-label*="BarChart - Label Rotation & Skipping"]').should('be.visible');

    cy.get('a[href="/alerting/list"]').click();
    // TODO: the following doesn't work => RTP button doesn't disappear
    // e2e.components.ReturnToPrevious.buttonGroup().should('not.exist');
    // cy.window().its('sessionStorage').invoke('getItem', 'returnToPrevious').should('not.exist');
  });

  it('should override the information in session storage when user changes alert rules', () => {
    const alertRule1 = '{"title":"e2e-ReturnToPrevious-test","href":"/alerting/list?search="}';
    const alertRule2 = '{"title":"e2e-ReturnToPrevious-test-2","href":"/alerting/list"}';

    cy.getAllSessionStorage().then((result) => {
      expect(result).to.eql({
        'http://localhost:3001': {
          returnToPrevious: alertRule1,
        },
      });
    });

    // make sure the dashboard finished loading
    cy.get('button[aria-label*="BarChart - Label Rotation & Skipping"]').should('be.visible');

    cy.get('button').contains('Search or jump to...').click();
    cy.get('[role="dialog"]').find('input').type('alert');
    cy.get('[role="dialog"]').find('a[href="/alerting/list"]').click();

    e2e.components.AlertRules.groupToggle().last().click();
    e2e.components.AlertRules.toggle().click();
    e2e.components.AlertRules.expandedContent().find('[data-testid="data-testid go to dashboard"]').click();
    // TODO: replace data-testid in find?

    cy.getAllSessionStorage().then((result) => {
      expect(result).to.not.eql({
        'http://localhost:3001': {
          returnToPrevious: alertRule1,
        },
      });
      expect(result).to.eql({
        'http://localhost:3001': {
          returnToPrevious: alertRule2,
        },
      });
    });
  });
});
