import { e2e } from '../utils';

describe('ReturnToPrevious button', () => {
  before(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    cy.window().then((win) => {
      win.localStorage.setItem('grafana.featureToggles', 'returnToPrevious=1');
    });
  });

  it('expected behaviour: appear when changing context, go back to alert rule when clicking "Back", remove when clicking "Dismiss"', () => {
    cy.visit('/alerting/list?search=');
    cy.get('[data-testid="group-collapse-toggle"]').click();
    cy.get('[data-testid="collapse-toggle"]').click();
    cy.get('[data-testid="expanded-content"]').find('[data-testid="data-testid go to dashboard"]').click();

    // make sure the dashboard finished loading
    cy.get('button[aria-label*="BarChart - Label Rotation & Skipping"]').should('be.visible');

    // check whether all elements of RTP are available
    cy.get('[data-testid="data-testid dismissable button group"]').should('be.visible');
    cy.get('[data-testid="data-testid dismiss"]').should('be.visible');
    cy.get('[data-testid="data-testid back"]').should('be.visible').click();

    // go back to alert rule
    cy.get('[data-testid="group-collapse-toggle"]').should('be.visible').click();
    cy.get('[data-testid="collapse-toggle"]').should('be.visible').click();
    cy.get('[data-testid="expanded-content"]').find('[data-testid="data-testid go to dashboard"]').click();
  });
  // TODO: check whether the data on the session storage are deleted
});
