import { e2e } from '../utils';

describe('ReturnToPrevious button', () => {
  before(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    cy.window().then((win) => {
      win.localStorage.setItem('grafana.featureToggles', 'returnToPrevious=1');
    });

    // Create a new alert rule with linked dashboard
    cy.visit('/alerting/list?search=');

    cy.get('[data-testid="data-testid Call to action button New alert rule"]').click();
    cy.get('[id="name"]').type('test rule');

    cy.get('[data-testid="data-testid create folder"]').click();
    cy.get('[id="folderName"]').last().type('test folder {enter}');

    cy.get('[data-testid="data-testid create evaluation group"]').click();
    cy.get('[id="group"]').last().type('test group');
    cy.get('[id="eval-every-input"]').type('5m');
    cy.get('[type="submit"]').click();

    cy.get('[data-testid="data-testid save rule exit"]').click();
    cy.wait(600); // TODO: use await instead?

    // Create a test dashboard incl. test panel
    cy.visit('/dashboards');
    cy.get('[data-testid="data-testid browse dashboards row test folder"]').find('a').click();
    cy.get('[data-testid="data-testid Call to action button Create Dashboard"]').click();
    cy.get('[aria-label="Save dashboard"]').click();
    cy.get('[aria-label="Save dashboard button"]').click();
    cy.wait(600); // TODO: use await instead?

    cy.get('[data-testid="data-testid Create new panel button"]').click();
    cy.get('[role="dialog"]').find('[data-testid="data-source-card"]').first().click();
    cy.get('[title="Apply changes and save dashboard"]').click();
    cy.get('[aria-label="Dashboard settings Save Dashboard Modal Save button"]').click();

    // Link alert rule to dashboard
    cy.visit('/alerting/list?search=');
    cy.get('[data-testid="group-collapse-toggle"]').click();
    cy.get('[data-testid="row"]').find('a[title="Edit"]').click();
    cy.get('[data-testid="data-testid link dashboard and panel"]').click();

    cy.get('[role="dialog"]').find('input[title="Search dashboard"]').type('New dashboard');
    cy.get('[title="New dashboard"]').click();
    cy.get('[title="Panel Title"]').click();
    cy.get('[type="button"]').last().click(); // TODO: find the confirm button in a better way?
    cy.get('[data-testid="data-testid save rule exit"]').click();
    cy.wait(600); // TODO: use await instead?
  });

  after(() => {
    // Delete alert rule
    cy.visit('/alerting/list?search=');
    cy.get('[data-testid="group-collapse-toggle"]').click();
    cy.get('[data-testid="row"]').find('[type="button"]').last().click();
    cy.get('[role="menuitem"]').last().click();
    cy.get('[data-testid="data-testid Confirm Modal Danger Button"]').click();

    // Delete test folder for clean up reasons
    cy.visit('/dashboards');
    cy.get('[data-testid="data-testid browse dashboards row test folder"]').find('a').click();
    cy.get('[data-testid="data-testid folder actions button"]').click();
    cy.get('[id="grafana-portal-container"]').find('button').last().click();
    cy.get('[role="dialog"]').find('input').type('Delete');
    cy.get('[data-testid="data-testid Confirm Modal Danger Button"]').click();
  });

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
    // TODO: check this again
    cy.get('[data-testid="group-collapse-toggle"]').click();
    cy.get('[data-testid="collapse-toggle"]').click();
    cy.get('[data-testid="expanded-content"]'); // TODO: check for exact alert rule name
  });
  // TODO: check whether the data on the session storage are deleted
  // it('should remove the DismissableButton when clicking close', () => {
  // })
});
