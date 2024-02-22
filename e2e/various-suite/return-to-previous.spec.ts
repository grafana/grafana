import { e2e } from '../utils';

describe('ReturnToPrevious button', () => {
  before(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    cy.window().then((win) => {
      win.localStorage.setItem('grafana.featureToggles', 'returnToPrevious=1');
    });

    // TODO: move to after() when I'm done with the tests
    // Delete alert rule
    cy.visit('/alerting/list?search=');
    cy.get('[data-testid="group-collapse-toggle"]').click();
    cy.get('[data-testid="row"]').find('[type="button"]').last().click();
    cy.get('[role="menuitem"]').last().click();
    cy.get('[data-testid="data-testid Confirm Modal Danger Button"]').click();
    //TODO

    // Create a new alert rule with linked dashboard
    cy.visit('/alerting/list?search=');

    cy.get('[data-testid="data-testid Call to action button New alert rule"]').click();
    cy.get('[id="name"]').type('test rule');

    cy.get('[data-testid="data-testid Folder picker select container"]').type('{enter}');

    cy.get('[data-testid="data-testid create evaluation group"]').click();
    cy.get('[id="group"]').last().type('test group');
    cy.get('[id="eval-every-input"]').type('5m');
    cy.get('[type="submit"]').click();

    cy.get('[data-testid="data-testid link dashboard and panel"]').click();
    cy.get('[role="dialog"]').find('input[title="Search dashboard"]').type('Grafana Dev');
    cy.get('[title="Grafana Dev Overview & Home"]').click();
    cy.get('[title="Starred"]').click();
    cy.get('[type="button"]').last().click(); // TODO: find the confirm button in a better way?
    cy.get('[data-testid="data-testid save rule exit"]').click();
    cy.wait(600); // TODO: use await instead?
  });

  // after(() => {
  //   // Delete alert rule
  //   cy.visit('/alerting/list?search=');
  //   cy.get('[data-testid="group-collapse-toggle"]').click();
  //   cy.get('[data-testid="row"]').find('[type="button"]').last().click();
  //   cy.get('[role="menuitem"]').last().click();
  //   cy.get('[data-testid="data-testid Confirm Modal Danger Button"]').click();
  // });

  it('expected behaviour: appear when changing context, go back to alert rule when clicking "Back", remove when clicking "Dismiss"', () => {
    cy.visit('/alerting/list?search=');
    cy.get('[data-testid="group-collapse-toggle"]').click();
    cy.get('[data-testid="collapse-toggle"]').click();
    cy.get('[data-testid="expanded-content"]').find('[data-testid="data-testid go to dashboard"]').click();

    // check whether all elements of RTP are available
    cy.get('[data-testid="data-testid dismissable button group"]').should('be.visible');
    cy.get('[data-testid="data-testid back"]').should('be.visible');
    cy.get('[data-testid="data-testid dismiss"]').should('be.visible');

    cy.get('[data-testid="data-testid back"]').click();
    // // TODO: check this again
    // cy.get('[data-testid="group-collapse-toggle"]').click();
    // cy.get('[data-testid="collapse-toggle"]').click();
    // cy.get('[data-testid="expanded-content"]'); // TODO: check for exact alert rule name
  });
  // TODO: check whether the data on the session storage are deleted
  it('should remove the DismissableButton when clicking close', () => {});
});
