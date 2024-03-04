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
    e2e.components.AlertRules.toDashboard().click();
  });

  it('should appear when changing context and go back to alert rule when clicking "Back"', () => {
    const url = 'http://localhost:3001/alerting/grafana/bddn0v6f1kgzkc/view?returnTo=%2Falerting%2Flist';

    // make sure the dashboard finished loading
    cy.get('button[aria-label*="BarChart - Label Rotation & Skipping"]').should('be.visible');

    // check whether all elements of RTP are available
    e2e.components.ReturnToPrevious.buttonGroup().should('be.visible');
    e2e.components.ReturnToPrevious.dismissButton().should('be.visible');
    e2e.components.ReturnToPrevious.backButton()
      .find('span')
      .contains('Back to e2e-ReturnToPrevious-test')
      .should('be.visible')
      .click();

    // check whether the RTP button leads back to alert rule
    cy.url().should('eq', url);
  });

  it('should disappear and clear session storage when clicking "Dismiss"', () => {
    cy.window().its('sessionStorage').invoke('getItem', 'returnToPrevious').should('exist');
    e2e.components.ReturnToPrevious.dismissButton().should('be.visible').click();
    e2e.components.ReturnToPrevious.buttonGroup().should('not.exist');
    cy.window().its('sessionStorage').invoke('getItem', 'returnToPrevious').should('not.exist');
  });

  it('should not persist when going back to the alert rule details view', () => {
    e2e.components.ReturnToPrevious.buttonGroup().should('be.visible');
    cy.window().its('sessionStorage').invoke('getItem', 'returnToPrevious').should('exist');

    // make sure the dashboard finished loading
    cy.get('button[aria-label*="BarChart - Label Rotation & Skipping"]').should('be.visible');

    cy.get('a[href="/alerting/list"]').click();
    e2e.components.AlertRules.groupToggle().first().click();
    cy.get('a[title="View"]').click();
    e2e.components.ReturnToPrevious.buttonGroup().should('not.exist');
    cy.window().its('sessionStorage').invoke('getItem', 'returnToPrevious').should('not.exist');
  });

  it('should override the information in session storage when user changes alert rules', () => {
    const alertRule1 =
      '{"title":"e2e-ReturnToPrevious-test","href":"/alerting/grafana/bddn0v6f1kgzkc/view?returnTo=%2Falerting%2Flist"}';
    const alertRule2 =
      '{"title":"e2e-ReturnToPrevious-test-2","href":"/alerting/grafana/dddyksihq7h1ca/view?returnTo=%2Falerting%2Flist"}';

    cy.window()
      .its('sessionStorage')
      .invoke('getItem', 'returnToPrevious')
      .then((result) => {
        expect(result).to.eql(alertRule1);
      });

    // make sure the dashboard finished loading
    cy.get('button[aria-label*="BarChart - Label Rotation & Skipping"]').should('be.visible');

    cy.get('button').contains('Search or jump to...').click();
    cy.get('[role="dialog"]').find('input').type('alert');
    cy.get('[role="dialog"]').find('a[href="/alerting/list"]').click();

    e2e.components.AlertRules.groupToggle().last().click();
    cy.get('a[title="View"]').click();
    e2e.components.AlertRules.toDashboard().click();

    cy.window()
      .its('sessionStorage')
      .invoke('getItem', 'returnToPrevious')
      .then((result) => {
        expect(result).to.not.eql(alertRule1);
        expect(result).to.eql(alertRule2);
      });
  });
});
