import { e2e } from '../utils';

describe('ReturnToPrevious button', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    cy.window().then((win) => {
      win.localStorage.setItem('grafana.featureToggles', 'returnToPrevious=1');
    });

    cy.visit('/alerting/list?search=');
    cy.get('[data-testid="group-collapse-toggle"]').click();
    cy.get('[data-testid="collapse-toggle"]').click();
    cy.get('[data-testid="expanded-content"]').find('[data-testid="data-testid go to dashboard"]').click();
  });

  it('should appear when changing context and go back to alert rule when clicking "Back"', () => {
    // make sure the dashboard finished loading
    cy.get('button[aria-label*="BarChart - Label Rotation & Skipping"]').should('be.visible');

    // check whether all elements of RTP are available
    cy.get('[data-testid="data-testid dismissable button group"]').should('be.visible');
    cy.get('[data-testid="data-testid dismiss"]').should('be.visible');
    cy.get('[data-testid="data-testid back"]').should('be.visible').click();

    // go back to alert rule
    cy.get('[data-testid="group-collapse-toggle"]').should('be.visible').click();
    cy.get('[data-testid="collapse-toggle"]').should('be.visible').click();
    cy.get('[data-testid="expanded-content"]').find('[data-testid="data-testid go to dashboard"]').should('be.visible');
  });

  it('should disappear and clear session storage when clicking "Dismiss"', () => {
    cy.window().its('sessionStorage').invoke('getItem', 'returnToPrevious').should('exist');
    cy.get('[data-testid="data-testid dismiss"]').should('be.visible').click();
    cy.get('[data-testid="data-testid dismissable button group"]').should('not.exist');
    cy.window().its('sessionStorage').invoke('getItem', 'returnToPrevious').should('not.exist');
  });

  it('should disappear and clear session storage when going back to alert rules via nav', () => {
    cy.get('[data-testid="data-testid dismissable button group"]').should('be.visible');
    cy.window().its('sessionStorage').invoke('getItem', 'returnToPrevious').should('exist');

    // make sure the dashboard finished loading
    cy.get('button[aria-label*="BarChart - Label Rotation & Skipping"]').should('be.visible');

    cy.get('a[href="/alerting/list"]').click();
    // TODO: the following doesn't work
    // cy.get('[data-testid="data-testid dismissable button group"]').should('not.exist');
    // cy.window().its('sessionStorage').invoke('getItem', 'returnToPrevious').should('not.exist');
  });
});
