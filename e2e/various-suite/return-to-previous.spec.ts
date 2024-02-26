import { e2e } from '../utils';

describe('ReturnToPrevious button', () => {
  before(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    cy.window().then((win) => {
      win.localStorage.setItem('grafana.featureToggles', 'returnToPrevious=1');
    });
  });

  // after(() => {
  //   // TODO: check whether I need to clean up something
  // });

  it('expected behaviour: appear when changing context, go back to alert rule when clicking "Back", remove when clicking "Dismiss"', () => {
    cy.visit('/alerting/list?search=');
    cy.get('[data-testid="group-collapse-toggle"]').click();
    cy.get('[data-testid="collapse-toggle"]').click();
    cy.get('[data-testid="expanded-content"]').find('[data-testid="data-testid go to dashboard"]').click();

    // check whether all elements of RTP are available and go back to alert rule
    cy.get('[data-testid="data-testid dismissable button group"]').should('be.visible');
    cy.get('[data-testid="data-testid back"]').should('be.visible');
    cy.get('[data-testid="data-testid dismiss"]').should('be.visible');
    cy.get('[data-testid="data-testid back"]').click();
    // cy.wait(6000) // TODO: replace this
    //
    // // check
    // cy.get('[data-testid="group-collapse-toggle"]').click();
    // cy.get('[data-testid="collapse-toggle"]').click();
    // cy.get('[data-testid="expanded-content"]').find('[data-testid="data-testid go to dashboard"]').click();
  });
  // TODO: check whether the data on the session storage are deleted
});
